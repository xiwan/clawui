/**
 * 所有 prompt 集中管理
 */

/** a2ui_render tool description — 告诉 Agent 怎么用这个工具 */
export const TOOL_DESCRIPTION = `Render UI. Pass raw data from tools directly, ClawUI auto-selects the best template.

Usage: { "rawData": "<tool output text>", "intent": "<what user wanted>" }

Only if you need a specific template: { "template": "<name>", "data": { ... } }
Templates: text_display, confirmation, form, data_table, dashboard, status_page, detail, multi_card, search_results, settings, accordion, skill_list, booking_form

Prefer rawData mode — it's faster and simpler. One call only, keep it minimal.`;

/** agent-loop: 用户 UI 操作转发给 Agent 的 prompt */
export function actionPrompt(intent: string): string {
  return [
    `[ClawUI] ${intent}`,
    `执行操作后，调用 a2ui_render 时请用 rawData 模式：{ "rawData": "<工具返回的原始文本>", "intent": "<用户意图>" }。不要手动选模板，ClawUI 会自动处理。只调一次 a2ui_render，保持简洁。`,
  ].join("\n");
}

/** 声明式路由命中时的 prompt */
export function toolRoutePrompt(actionName: string, tool: string, args: unknown): string {
  return `[ClawUI] 用户操作 "${actionName}" 映射到工具 ${tool}，参数：${JSON.stringify(args)}。请调用该工具，然后用 a2ui_render 的 rawData 模式渲染结果。`;
}

/** RAG replay 模式的 prompt */
export function ragReplayPrompt(query: string): string {
  return `[ClawUI] 用户请求: "${query}"\n请获取最新数据并用 a2ui_render 的 rawData 模式渲染结果。`;
}

/** lite-render: 轻量 LLM 渲染器的 system prompt */
export const LITE_RENDER_SYSTEM = `你是 JSON 格式化器。把原始数据转成最适合的 UI 模板，只输出 JSON。

模板（按优先级选择最匹配的）:
- data_table: 表格数据 → { title?, columns: [{ key, label }], rows: [{ key: value }] }
- dashboard: 数值指标/统计 → { title?, metrics: [{ label, value, trend? }] }
- detail: 单条记录的键值对 → { title?, fields: [{ label, value }] }
- multi_card: 多项分类/功能入口 → { title?, columns?: 2|3, cards: [{ title, content?, icon? }] }
- search_results: 搜索/列表结果 → { query?, results: [{ title, snippet }] }
- accordion: 分组/层级/目录结构 → { sections: [{ title, content }] }
- status_page: 操作结果反馈 → { status: "success"|"error"|"info", title, message?, details?: [{ label, value }] }
- text_display: 长文本/代码/markdown → { title?, text }

规则:
- 有表格结构（行列）→ data_table
- 多个数值指标 → dashboard
- 单条记录键值对 → detail
- 多个同类项（卡片）→ multi_card 或 search_results
- 树状输出/代码/日志/CLI 输出 → text_display，text 用 \`\`\` 包裹保持格式
- 操作结果（成功/失败）→ status_page
- 分组内容（每组有标题+正文）→ accordion
- text_display 的 text 字段支持 markdown：\`\`\`代码块\`\`\`、**粗体**、列表等

输出: {"template":"模板名","data":{...}}`;