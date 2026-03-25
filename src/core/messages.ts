/**
 * ClawUI 扩展消息 — 框架控制协议
 * 在标准 A2UI JSONL 之外，ClawUI 定义的自定义消息
 */

import type { TaskState } from "./state-machine.js";
import type { SlotId } from "./frame-manager.js";

/** 框架状态切换 */
export function frameStateMsg(state: TaskState, transition?: string): string {
  return JSON.stringify({ clawui: { frameState: { state, ...(transition ? { transition } : {}) } } });
}

/** 槽位可见性 */
export function slotVisibilityMsg(slots: Partial<Record<SlotId, boolean>>): string {
  return JSON.stringify({ clawui: { slotVisibility: slots } });
}

/** Toast 通知 */
export function toastMsg(message: string, type: "success" | "info" | "warning" | "error" = "info", duration = 3000): string {
  return JSON.stringify({ clawui: { toast: { message, type, duration } } });
}
