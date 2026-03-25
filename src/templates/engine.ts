/**
 * 模板引擎 — 查找模板 → 填充数据 → 输出 A2UI 组件
 */

import * as registry from "./registry.js";
import { bindData } from "../utils/data-binding.js";
import type { A2UIComponent } from "../utils/jsonl.js";

export interface RenderInput {
  template?: string;
  components?: A2UIComponent[];
  data?: Record<string, unknown>;
}

type Expander = (components: Record<string, unknown>[], data: Record<string, unknown>) => Record<string, unknown>[];

/** 动态展开：将 data 中的数组项生成为子组件，注入到指定容器的 children 中 */
function expandArray(
  containerId: string,
  arrayKey: string,
  itemToComponents: (item: Record<string, unknown>, index: number) => Record<string, unknown>[],
): Expander {
  return (components, data) => {
    const items = data[arrayKey] as Record<string, unknown>[] | undefined;
    if (!items?.length) return components;

    const childIds: string[] = [];
    const generated: Record<string, unknown>[] = [];
    for (let i = 0; i < items.length; i++) {
      const parts = itemToComponents(items[i], i);
      childIds.push(parts[0].id as string);
      generated.push(...parts);
    }

    return components
      .map((c) => (c.id === containerId ? { ...c, children: childIds } : c))
      .concat(generated);
  };
}

/** 各模板的动态展开规则 */
const expanders: Record<string, Expander> = {
  form: expandArray("fields", "fields", (item, i) => [
    { id: `field-${item.name}`, component: "TextField", label: item.label || item.name, value: { path: `/${item.name}` } },
  ]),

  search_results: expandArray("results", "results", (item, i) => {
    const cardId = `result-${i}`;
    const textId = `${cardId}-text`;
    return [
      { id: cardId, component: "Card", child: textId, title: item.title },
      { id: textId, component: "Text", text: `${item.snippet || item.subtitle || item.description || ""}`.trim() },
    ];
  }),

  dashboard: (components, data) => {
    const items = (data.metrics || []) as Record<string, unknown>[];
    if (!items.length) return components;
    const cols = items.length <= 4 ? items.length : items.length <= 6 ? 3 : 4;
    const rowIds: string[] = [];
    const generated: Record<string, unknown>[] = [];
    for (let i = 0; i < items.length; i += cols) {
      const rowId = `metric-row-${Math.floor(i / cols)}`;
      rowIds.push(rowId);
      const cellIds: string[] = [];
      for (let j = i; j < Math.min(i + cols, items.length); j++) {
        const item = items[j];
        const cardId = `metric-${j}`;
        const textId = `${cardId}-text`;
        const children = [textId];
        cellIds.push(cardId);
        generated.push({ id: textId, component: "Text", text: String(item.value ?? ""), variant: "h2" });
        if (item.trend) {
          const trendId = `${cardId}-trend`;
          children.push(trendId);
          generated.push({ id: trendId, component: "Text", text: String(item.trend) });
        }
        generated.push({ id: cardId, component: "Card", children, title: item.label });
      }
      generated.push({ id: rowId, component: "Row", children: cellIds });
    }
    return components
      .map(c => c.id === "metrics" ? { ...c, component: "Column", children: rowIds } : c)
      .concat(generated);
  },

  settings: expandArray("items", "settings", (item, i) => {
    if (item.type === "toggle") {
      return [{ id: `setting-${i}`, component: "Toggle", label: item.label, value: { path: `/${item.name}` } }];
    }
    return [{ id: `setting-${i}`, component: "TextField", label: item.label, value: { path: `/${item.name}` } }];
  }),

  accordion: expandArray("items", "sections", (item, i) => {
    const sectionId = `section-${i}`;
    const titleId = `${sectionId}-title`;
    const contentId = `${sectionId}-content`;
    return [
      { id: sectionId, component: "Card", children: [titleId, contentId], title: item.title },
      { id: titleId, component: "Button", child: `${titleId}-label`, action: { event: { name: `toggle-${i}` } }, accordion: true },
      { id: `${titleId}-label`, component: "Text", text: `▶ ${item.title}` },
      { id: contentId, component: "Text", text: item.content || "", accordion_body: true },
    ];
  }),

  data_table: (components, data) => {
    const columns = (data.columns || []) as { key: string; label: string }[];
    const rows = (data.rows || []) as Record<string, unknown>[];
    if (!columns.length) return components;

    // 表头
    const headIds = columns.map((c, i) => `th-${i}`);
    const headCells = columns.map((c, i) => ({ id: `th-${i}`, component: "Text", text: c.label, variant: "h3" }));

    // 数据行
    const rowIds: string[] = [];
    const rowComponents: Record<string, unknown>[] = [];
    for (let r = 0; r < rows.length; r++) {
      const rowId = `row-${r}`;
      rowIds.push(rowId);
      const cellIds = columns.map((c, ci) => `row-${r}-cell-${ci}`);
      rowComponents.push({ id: rowId, component: "Row", children: cellIds });
      for (let ci = 0; ci < columns.length; ci++) {
        rowComponents.push({ id: `row-${r}-cell-${ci}`, component: "Text", text: String(rows[r][columns[ci].key] ?? "") });
      }
    }

    return components
      .map(c => c.id === "table-head" ? { ...c, children: headIds } : c)
      .map(c => c.id === "table-body" ? { ...c, children: rowIds } : c)
      .concat(headCells, rowComponents);
  },

  status_page: expandArray("details", "details", (item, i) => {
    const rowId = `detail-${i}`;
    return [
      { id: rowId, component: "Row", children: [`${rowId}-label`, `${rowId}-value`] },
      { id: `${rowId}-label`, component: "Text", text: `${item.label}:`, variant: "h3" },
      { id: `${rowId}-value`, component: "Text", text: String(item.value ?? "") },
    ];
  }),

  detail: expandArray("fields", "fields", (item, i) => {
    const rowId = `field-row-${i}`;
    return [
      { id: rowId, component: "Row", children: [`${rowId}-label`, `${rowId}-value`] },
      { id: `${rowId}-label`, component: "Text", text: `${item.label}:`, variant: "h3" },
      { id: `${rowId}-value`, component: "Text", text: String(item.value ?? "") },
    ];
  }),

  home_screen: (components, data) => {
    const apps = (data.apps || []) as Record<string, unknown>[];
    const recents = (data.recents || []) as Record<string, unknown>[];
    const appIds: string[] = [];
    const generated: Record<string, unknown>[] = [];

    for (let i = 0; i < apps.length; i++) {
      const app = apps[i];
      const id = `app-${i}`;
      appIds.push(id);
      generated.push(
        { id, component: "Card", children: [`${id}-icon`, `${id}-label`], clickAction: { event: { name: "submit" }, context: { text: app.prompt } }, style: "app-icon" },
        { id: `${id}-icon`, component: "Text", text: String(app.icon || "📦"), variant: "h1" },
        { id: `${id}-label`, component: "Text", text: String(app.label || "") },
      );
    }

    const recentIds: string[] = [];
    for (let i = 0; i < recents.length; i++) {
      const r = recents[i];
      const id = `recent-${i}`;
      recentIds.push(id);
      generated.push(
        { id, component: "Row", children: [`${id}-icon`, `${id}-label`, `${id}-time`], clickAction: { event: { name: "submit" }, context: { text: r.prompt || r.label } }, style: "recent-item" },
        { id: `${id}-icon`, component: "Text", text: String(r.icon || "📋") },
        { id: `${id}-label`, component: "Text", text: String(r.label || "") },
        { id: `${id}-time`, component: "Text", text: String(r.time || "") },
      );
    }

    return components
      .map(c => c.id === "apps-grid" ? { ...c, children: appIds } : c)
      .map(c => c.id === "recents-section" ? { ...c, children: ["recents-title", ...recentIds] } : c)
      .concat(generated);
  },

  multi_card: (components, data) => {
    const cards = (data.cards || []) as Record<string, unknown>[];
    const cols = (data.columns as number) || 2;
    if (!cards.length) return components;

    const rowIds: string[] = [];
    const generated: Record<string, unknown>[] = [];

    for (let i = 0; i < cards.length; i += cols) {
      const rowId = `card-row-${Math.floor(i / cols)}`;
      rowIds.push(rowId);
      const cellIds: string[] = [];
      for (let j = i; j < Math.min(i + cols, cards.length); j++) {
        const card = cards[j];
        const cardId = `card-${j}`;
        const textId = `${cardId}-text`;
        cellIds.push(cardId);
        const children = [textId];
        if (card.icon) children.unshift(`${cardId}-icon`);
        generated.push({ id: cardId, component: "Card", title: card.title, children, ...(card.action ? { clickAction: card.action } : {}) });
        if (card.icon) generated.push({ id: `${cardId}-icon`, component: "Text", text: String(card.icon), variant: "h1" });
        generated.push({ id: textId, component: "Text", text: String(card.content || "") });
      }
      generated.push({ id: rowId, component: "Row", children: cellIds });
    }

    return components
      .map(c => c.id === "grid" ? { ...c, children: rowIds } : c)
      .concat(generated);
  },
};

/** 模板默认数据（用户未提供时的 fallback 值） */
const templateDefaults: Record<string, Record<string, unknown>> = {
  confirmation: { confirmLabel: "Confirm", cancelLabel: "Cancel" },
};

/** 数据别名：兼容不同字段名 */
function applyAliases(template: string, data: Record<string, unknown>): Record<string, unknown> {
  if (template === "text_display" && data.body && !data.text) {
    return { ...data, text: data.body };
  }
  return data;
}

/** 渲染模板或自定义组件，返回 A2UI 组件列表 */
export function render(input: RenderInput): { components: A2UIComponent[]; actions: Record<string, unknown> } {
  if (input.components) {
    const bound = bindData(input.components, input.data || {}) as A2UIComponent[];
    return { components: bound, actions: {} };
  }

  if (!input.template) throw new Error("Either 'template' or 'components' is required");

  const tpl = registry.get(input.template);
  if (!tpl) throw new Error(`Template not found: ${input.template}`);

  let components = [...tpl.components];
  const defaults = templateDefaults[input.template];
  const rawData = defaults ? { ...defaults, ...input.data } : (input.data || {});
  const data = applyAliases(input.template, rawData);

  const expand = expanders[input.template];
  if (expand) components = expand(components, data);

  const bound = bindData(components, data) as A2UIComponent[];
  return { components: bound, actions: tpl.defaultActions || {} };
}

/** 组合渲染：多个模板拼接到同一个 Surface */
export function renderMulti(items: RenderInput[]): { components: A2UIComponent[]; actions: Record<string, unknown> } {
  const allComponents: A2UIComponent[] = [];
  const allActions: Record<string, unknown> = {};
  const sectionIds: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const prefix = `s${i}`;
    const { components, actions } = render(items[i]);
    // 给每个模板的 id 加前缀避免冲突
    const prefixed = components.map(c => {
      const pc = { ...c, id: `${prefix}-${c.id}` } as any;
      if (Array.isArray(pc.children)) pc.children = pc.children.map((id: string) => `${prefix}-${id}`);
      if (typeof pc.child === "string") pc.child = `${prefix}-${pc.child}`;
      return pc;
    });
    sectionIds.push(prefixed[0].id);
    allComponents.push(...prefixed);
    Object.assign(allActions, actions);
  }

  // 用 Column 包裹所有 section
  allComponents.unshift({ id: "multi-root", component: "Column", children: sectionIds } as any);
  return { components: allComponents as A2UIComponent[], actions: allActions };
}
