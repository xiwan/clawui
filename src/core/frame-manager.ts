/**
 * ClawUI 四槽位框架管理器
 * Header / Canvas / Actions / Context — 每个槽位是独立 Surface
 */

import type { TaskState } from "./state-machine.js";

export type SlotId = "header" | "canvas" | "actions" | "context";

export interface SlotConfig {
  visible: boolean;
  compact?: boolean;
}

export interface FrameConfig {
  header: SlotConfig;
  canvas: SlotConfig;
  actions: SlotConfig & { buttons?: string[] };
  context: SlotConfig;
}

/** 各状态的默认框架配置 */
const STATE_FRAMES: Record<TaskState, FrameConfig> = {
  idle: {
    header: { visible: true, compact: true },
    canvas: { visible: true },
    actions: { visible: false },
    context: { visible: false },
  },
  working: {
    header: { visible: true },
    canvas: { visible: true },
    actions: { visible: true, buttons: ["cancel"] },
    context: { visible: false },
  },
  review: {
    header: { visible: true },
    canvas: { visible: true },
    actions: { visible: true, buttons: ["confirm", "edit", "cancel"] },
    context: { visible: true },
  },
  done: {
    header: { visible: true, compact: true },
    canvas: { visible: true },
    actions: { visible: true, buttons: ["new-task"] },
    context: { visible: false },
  },
  error: {
    header: { visible: true },
    canvas: { visible: true },
    actions: { visible: true, buttons: ["retry", "cancel"] },
    context: { visible: false },
  },
};

export function getFrameConfig(state: TaskState): FrameConfig {
  return STATE_FRAMES[state];
}

/** 生成 surfaceId: "{prefix}:{slot}" */
export function slotSurfaceId(slot: SlotId, prefix = "main"): string {
  return `${prefix}:${slot}`;
}
