/**
 * Agent Loop — 用户 UI 操作 → 自然语言命令 → 注入 Agent 会话
 * Agent 收到后自行决策，可能再次调用 a2ui_render 渲染新界面，形成交互闭环。
 */

export interface UserAction {
  name: string;
  surfaceId: string;
  sourceComponentId?: string;
  context: Record<string, unknown>;
  formData?: Record<string, unknown>;
  /** 当前界面的语义信息（模板名、标题等） */
  uiMeta?: { template?: string; title?: string };
}

export interface AgentLoopApi {
  runAgent: (message: string) => Promise<void>;
  logger?: { info?: (msg: string) => void };
}

/** 将用户 UI 操作转换为自然语言命令 */
export function formatActionPrompt(action: UserAction): string {
  const tpl = action.uiMeta?.template || "";
  const title = action.uiMeta?.title || "";
  const fd = action.formData && Object.keys(action.formData).length ? action.formData : null;

  // 构建场景描述
  const scene = title ? `"${title}"` : tpl ? `${tpl} 界面` : `界面 ${action.surfaceId}`;

  // 构建用户意图的自然语言
  let intent: string;
  if (action.name === "cancel" || action.name === "close") {
    intent = `用户在${scene}上点击了取消。`;
  } else if (action.name === "confirm" || action.name === "submit") {
    const text = (action.context?.text as string) || "";
    const summary = text || (fd ? describeFormData(fd) : "");
    intent = `用户在${scene}上确认提交${summary ? "：" + summary : "。"}`;
  } else {
    const text = (action.context?.text as string) || "";
    const summary = text || (fd ? describeFormData(fd) : "");
    intent = `用户在${scene}上触发了操作 "${action.name}"${summary ? "，数据：" + summary : "。"}`;
  }

  return [
    `[ClawUI] ${intent}`,
    `请根据用户意图执行相应操作，然后调用 a2ui_render 渲染新界面展示结果。`,
  ].join("\n");
}

/** 将 formData 转为可读摘要 */
function describeFormData(fd: Record<string, unknown>): string {
  return Object.entries(fd)
    .filter(([, v]) => v !== "" && v != null)
    .map(([k, v]) => `${k}=${typeof v === "boolean" ? (v ? "开" : "关") : v}`)
    .join("，");
}

/** 处理用户操作：格式化为自然语言 → 注入 Agent */
export async function handleUserAction(action: UserAction, api: AgentLoopApi): Promise<void> {
  const prompt = formatActionPrompt(action);
  api.logger?.info?.(`ClawUI → Agent: ${action.name} → "${prompt.split("\n")[0]}"`);
  await api.runAgent(prompt);
}
