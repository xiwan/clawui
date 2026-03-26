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
    const titleId = `${cardId}-title`;
    const snippetId = `${cardId}-snippet`;
    const children = [titleId, snippetId];
    const comps: Record<string, unknown>[] = [
      { id: titleId, component: "Text", text: String(item.title || ""), variant: "h3" },
      { id: snippetId, component: "Text", text: `${item.snippet || item.subtitle || item.description || ""}`.trim(), variant: "body" },
    ];
    if (item.source || item.url) {
      const srcId = `${cardId}-src`;
      children.push(srcId);
      comps.push({ id: srcId, component: "Text", text: String(item.source || item.url || ""), variant: "caption", style: "result-source" });
    }
    comps.push({ id: cardId, component: "Card", children, style: "result-card" });
    return comps;
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
        const labelId = `${cardId}-label`;
        const valueId = `${cardId}-value`;
        const children = [labelId, valueId];
        cellIds.push(cardId);
        // 标签行
        generated.push({ id: labelId, component: "Text", text: String(item.label ?? ""), variant: "body" });
        // 数值（大字）
        generated.push({ id: valueId, component: "Text", text: String(item.value ?? ""), variant: "h1" });
        // 趋势指示
        if (item.trend) {
          const trendId = `${cardId}-trend`;
          children.push(trendId);
          const trendStr = String(item.trend);
          const isUp = trendStr.includes("↑") || trendStr.includes("+");
          const isDown = trendStr.includes("↓") || trendStr.includes("-");
          const trendStyle = isUp ? "trend-up" : isDown ? "trend-down" : "trend-neutral";
          generated.push({ id: trendId, component: "Text", text: trendStr, style: trendStyle });
        }
        // 描述/副标题
        if (item.description || item.subtitle) {
          const descId = `${cardId}-desc`;
          children.push(descId);
          generated.push({ id: descId, component: "Text", text: String(item.description || item.subtitle), variant: "caption" });
        }
        generated.push({ id: cardId, component: "Card", children, style: "metric-card" });
      }
      generated.push({ id: rowId, component: "Row", children: cellIds, style: "metric-row" });
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
      { id: sectionId, component: "Card", children: [titleId, contentId], title: item.title, style: "accordion-card" },
      { id: titleId, component: "Button", child: `${titleId}-label`, action: { event: { name: `toggle-${i}` } }, accordion: true },
      { id: `${titleId}-label`, component: "Text", text: `▶ ${item.title}` },
      { id: contentId, component: "Text", text: item.content || "", accordion_body: true },
    ];
  }),

  data_table: (components, data) => {
    const columns = (data.columns || []) as { key: string; label: string }[];
    const rows = (data.rows || []) as Record<string, unknown>[];
    if (!columns.length) return components;

    const headIds = columns.map((c, i) => `th-${i}`);
    const headCells = columns.map((c, i) => ({ id: `th-${i}`, component: "Text", text: c.label, variant: "h3", style: "table-th" }));

    const rowIds: string[] = [];
    const rowComponents: Record<string, unknown>[] = [];
    for (let r = 0; r < rows.length; r++) {
      const rowId = `row-${r}`;
      rowIds.push(rowId);
      const cellIds = columns.map((c, ci) => `row-${r}-cell-${ci}`);
      rowComponents.push({ id: rowId, component: "Row", children: cellIds, style: r % 2 === 0 ? "table-row-even" : "table-row-odd" });
      for (let ci = 0; ci < columns.length; ci++) {
        rowComponents.push({ id: `row-${r}-cell-${ci}`, component: "Text", text: String(rows[r][columns[ci].key] ?? ""), style: "table-cell" });
      }
    }

    return components
      .map(c => c.id === "table-head" ? { ...c, children: headIds, style: "table-head" } : c)
      .map(c => c.id === "table-body" ? { ...c, children: rowIds } : c)
      .concat(headCells, rowComponents);
  },

  status_page: expandArray("details", "details", (item, i) => {
    const rowId = `detail-${i}`;
    return [
      { id: rowId, component: "Row", children: [`${rowId}-label`, `${rowId}-value`], style: "status-detail-row" },
      { id: `${rowId}-label`, component: "Text", text: `${item.label}`, variant: "body", style: "status-label" },
      { id: `${rowId}-value`, component: "Text", text: String(item.value ?? ""), variant: "h3", style: "status-value" },
    ];
  }),

  detail: expandArray("fields", "fields", (item, i) => {
    const rowId = `field-row-${i}`;
    return [
      { id: rowId, component: "Row", children: [`${rowId}-label`, `${rowId}-value`], style: "detail-field-row" },
      { id: `${rowId}-label`, component: "Text", text: `${item.label}`, variant: "body", style: "detail-label" },
      { id: `${rowId}-value`, component: "Text", text: String(item.value ?? ""), style: "detail-value" },
    ];
  }),

  skill_list: expandArray("skills-list", "skills", (item, i) => {
    const id = `skill-${i}`;
    return [
      { id, component: "Card", children: [`${id}-head`, `${id}-desc`], style: "skill-card" },
      { id: `${id}-head`, component: "Row", children: [`${id}-icon`, `${id}-name`, `${id}-run`] },
      { id: `${id}-icon`, component: "Text", text: String(item.icon || "🎯"), variant: "h2" },
      { id: `${id}-name`, component: "Text", text: String(item.name || ""), variant: "h3" },
      { id: `${id}-run`, component: "Button", child: `${id}-run-label`, action: { event: { name: "submit" }, context: { text: item.prompt || `执行技能: ${item.name}` } }, style: "skill-run" },
      { id: `${id}-run-label`, component: "Text", text: "▶ 执行" },
      { id: `${id}-desc`, component: "Text", text: String(item.description || "") },
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
        const children: string[] = [];
        cellIds.push(cardId);
        if (card.icon) {
          children.push(`${cardId}-icon`);
          generated.push({ id: `${cardId}-icon`, component: "Text", text: String(card.icon), variant: "h1", style: "grid-card-icon" });
        }
        if (card.title) {
          children.push(`${cardId}-title`);
          generated.push({ id: `${cardId}-title`, component: "Text", text: String(card.title), variant: "h3" });
        }
        if (card.content) {
          children.push(`${cardId}-text`);
          generated.push({ id: `${cardId}-text`, component: "Text", text: String(card.content), variant: "body" });
        }
        generated.push({ id: cardId, component: "Card", children, style: "grid-card", ...(card.action ? { clickAction: card.action } : {}) });
      }
      generated.push({ id: rowId, component: "Row", children: cellIds, style: "grid-row" });
    }

    return components
      .map(c => c.id === "grid" ? { ...c, children: rowIds } : c)
      .concat(generated);
  },

  file_browser: (components, data) => {
    const path = String(data.path || "/");
    const items = (data.items || []) as Record<string, unknown>[];

    // 面包屑：拆路径生成可点击的导航
    const parts = path.split("/").filter(Boolean);
    const crumbIds: string[] = ["crumb-root"];
    const generated: Record<string, unknown>[] = [
      { id: "crumb-root", component: "Button", child: "crumb-root-label",
        action: { event: { name: "submit" }, context: { text: "列出 / 目录下的文件和文件夹，用 file_browser 模板渲染" } },
        style: "crumb-btn" },
      { id: "crumb-root-label", component: "Text", text: "~" },
    ];
    let accumulated = "";
    for (let i = 0; i < parts.length; i++) {
      accumulated += "/" + parts[i];
      const id = `crumb-${i}`;
      const sepId = `crumb-sep-${i}`;
      crumbIds.push(sepId, id);
      generated.push(
        { id: sepId, component: "Text", text: "/", style: "crumb-sep" },
        { id, component: "Button", child: `${id}-label`,
          action: { event: { name: "submit" }, context: { text: `列出 ${accumulated} 目录下的文件和文件夹，用 file_browser 模板渲染` } },
          style: "crumb-btn" },
        { id: `${id}-label`, component: "Text", text: parts[i] },
      );
    }

    // 文件列表
    const fileIds: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isDir = item.type === "directory" || item.type === "dir";
      const id = `file-${i}`;
      const name = String(item.name || "");
      const icon = isDir ? "📁" : fileIcon(name);
      const size = item.size ? String(item.size) : "";
      const modified = item.modified ? String(item.modified) : "";

      fileIds.push(id);
      const children = [`${id}-icon`, `${id}-name`];
      if (size) children.push(`${id}-size`);
      if (modified) children.push(`${id}-time`);

      const filePath = `${path === "/" ? "" : path}/${name}`;
      const prompt = isDir
        ? `列出 ${filePath} 目录下的文件和文件夹，用 file_browser 模板渲染，包含 name、type、size、modified`
        : `读取文件 ${filePath} 的内容，用 text_display 模板渲染，title 为文件名`;

      generated.push(
        { id, component: "Card", children, style: isDir ? "file-item file-dir" : "file-item",
          clickAction: { event: { name: "submit" }, context: { text: prompt } } },
        { id: `${id}-icon`, component: "Text", text: icon, style: "file-icon" },
        { id: `${id}-name`, component: "Text", text: name, variant: "body", style: isDir ? "file-name file-name-dir" : "file-name" },
      );
      if (size) generated.push({ id: `${id}-size`, component: "Text", text: size, variant: "caption", style: "file-meta" });
      if (modified) generated.push({ id: `${id}-time`, component: "Text", text: modified, variant: "caption", style: "file-meta" });
    }

    return components
      .map(c => c.id === "breadcrumb" ? { ...c, children: crumbIds, style: "breadcrumb" } : c)
      .map(c => c.id === "file-list" ? { ...c, children: fileIds } : c)
      .concat(generated);
  },
};

/** 文件图标映射 */
function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "📘", js: "📒", json: "📋", md: "📝", txt: "📄", py: "🐍",
    html: "🌐", css: "🎨", sh: "⚙️", yml: "📐", yaml: "📐",
    png: "🖼️", jpg: "🖼️", svg: "🖼️", gif: "🖼️",
    lock: "🔒", log: "📜", env: "🔑",
  };
  return map[ext] || "📄";
}

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
