/**
 * 骨架屏生成器 — 根据 uiMeta 生成对应模板的骨架占位 UI
 * 纯函数，输入语义信息，输出 A2UI components
 */

import type { A2UIRenderParams } from "../tool.js";
import { executeRender } from "../tool.js";
import { pushToPreview } from "../server.js";

interface UiMeta {
  template?: string;
  title?: string;
}

/** 骨架占位块：用 Card + 灰色文本模拟内容 */
function skeletonBlock(id: string, lines = 3): any[] {
  const children = Array.from({ length: lines }, (_, i) => `${id}-l${i}`);
  return [
    { id, component: "Card", child: `${id}-col` },
    { id: `${id}-col`, component: "Column", children },
    ...children.map((cid, i) => ({
      id: cid, component: "Text", text: "\u2003".repeat(i === 0 ? 20 : 12 + Math.floor(Math.random() * 10)),
      variant: "body", style: "skeleton-line",
    })),
  ];
}

/** 根据模板类型生成骨架 canvas 组件 */
function skeletonComponents(meta: UiMeta): any[] {
  const t = meta.template || "";

  // 表格类：表头 + 占位行
  if (t === "data_table") {
    return [
      { id: "root", component: "Column", children: ["sk-hdr", "sk-r0", "sk-r1", "sk-r2", "sk-r3"] },
      { id: "sk-hdr", component: "Text", text: "\u2003".repeat(30), variant: "body", style: "skeleton-line skeleton-header" },
      ...["sk-r0", "sk-r1", "sk-r2", "sk-r3"].map(id => (
        { id, component: "Text", text: "\u2003".repeat(25), variant: "body", style: "skeleton-line" }
      )),
    ];
  }

  // 仪表盘：多个卡片占位
  if (t === "dashboard" || t === "multi_card") {
    return [
      { id: "root", component: "Column", children: ["sk-grid"] },
      { id: "sk-grid", component: "Row", children: ["sk-c0", "sk-c1", "sk-c2"] },
      ...["sk-c0", "sk-c1", "sk-c2"].flatMap(id => skeletonBlock(id, 2)),
    ];
  }

  // 详情/表单类
  if (t === "detail" || t === "form" || t === "booking_form" || t === "settings") {
    return [
      { id: "root", component: "Column", children: ["sk-b0", "sk-b1"] },
      ...skeletonBlock("sk-b0", 4),
      ...skeletonBlock("sk-b1", 2),
    ];
  }

  // 通用：单块骨架
  return [
    { id: "root", component: "Column", children: ["sk-b0"] },
    ...skeletonBlock("sk-b0", 3),
  ];
}

/** 推送骨架屏到 Preview：header(working) + canvas(骨架) + actions(取消) */
export function pushSkeleton(meta: UiMeta): void {
  const title = meta.title || "处理中";

  // header: working 态
  const header = executeRender({
    slot: "header",
    components: [
      { id: "root", component: "Row", children: ["t", "s"] },
      { id: "t", component: "Text", text: title, variant: "h2" },
      { id: "s", component: "StatusIndicator", status: "working", text: "处理中..." },
    ],
    state: "working",
  });
  pushToPreview(header.jsonl, meta);

  // canvas: 骨架屏
  const canvas = executeRender({
    slot: "canvas",
    components: skeletonComponents(meta),
  });
  pushToPreview(canvas.jsonl);

  // actions: 取消按钮
  const actions = executeRender({
    slot: "actions",
    components: [
      { id: "root", component: "Row", children: ["cb"] },
      { id: "cb", component: "Button", child: "cbl", action: { event: { name: "cancel" } } },
      { id: "cbl", component: "Text", text: "取消" },
    ],
  });
  pushToPreview(actions.jsonl);
}
