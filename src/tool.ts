/**
 * a2ui_render — Agent Tool 实现
 * Agent 调用此工具，传入模板名+数据，生成 A2UI JSONL 并推送
 */

import { render, renderMulti } from "./templates/engine.js";
import { generateJsonl } from "./utils/jsonl.js";
import { toMarkdown } from "./fallback/markdown.js";
import { ActionRouter, type ActionMapping } from "./actions/router.js";
import { slotSurfaceId, type SlotId } from "./core/frame-manager.js";
import { frameStateMsg, toastMsg } from "./core/messages.js";
import type { TaskState } from "./core/state-machine.js";

export const actionRouter = new ActionRouter();

export interface A2UIRenderParams {
  template?: string;
  templates?: { template: string; data?: Record<string, unknown> }[];
  components?: { id: string; component: string; [key: string]: unknown }[];
  data?: Record<string, unknown>;
  actions?: Record<string, ActionMapping>;
  surfaceId?: string;
  /** Target slot: header | canvas | actions | context (default: canvas) */
  slot?: string;
  /** Task state transition: idle | working | review | done | error */
  state?: string;
  /** Toast notification */
  toast?: { message: string; type?: "success" | "info" | "warning" | "error"; duration?: number };
  fallback?: string;
}

export interface A2UIRenderResult {
  jsonl: string;
  fallbackMarkdown?: string;
}

/** 执行 a2ui_render：模板/组件 → JSONL + 注册 action 映射 */
export function executeRender(params: A2UIRenderParams): A2UIRenderResult {
  const slot = (params.slot || "canvas") as SlotId;
  const surfaceId = params.surfaceId || slotSurfaceId(slot);

  const extraLines: string[] = [];

  // 状态切换消息
  if (params.state) extraLines.push(frameStateMsg(params.state as TaskState));

  // Toast 消息
  if (params.toast) extraLines.push(toastMsg(params.toast.message, params.toast.type, params.toast.duration));

  const { components, actions: defaultActions } = params.templates?.length
    ? renderMulti(params.templates)
    : render({ template: params.template, components: params.components, data: params.data });

  // 合并 action 映射：模板默认 + Agent 指定（Agent 覆盖模板）
  const mergedActions = { ...defaultActions, ...params.actions } as Record<string, ActionMapping>;
  if (Object.keys(mergedActions).length) {
    actionRouter.register(surfaceId, mergedActions);
  }

  const jsonl = generateJsonl(surfaceId, components, params.data);
  const allJsonl = [...extraLines, jsonl].join("\n");
  const fallbackMarkdown = params.fallback === "auto" || params.fallback === undefined
    ? toMarkdown(components)
    : params.fallback || undefined;

  return { jsonl: allJsonl, fallbackMarkdown };
}
