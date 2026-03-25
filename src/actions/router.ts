/**
 * Action Router — 用户操作 → OpenClaw 工具调用
 * 支持声明式 argMapping（{{context.*}} 变量替换）和内置 action
 */

import { bindData } from "../utils/data-binding.js";
import { builtins, type BuiltinApi } from "./builtins.js";

export interface ActionMapping {
  tool?: string;
  action?: string;
  argMapping?: Record<string, unknown>;
  builtin?: string;
}

export type ResolvedAction =
  | { type: "tool"; tool: string; action?: string; args: Record<string, unknown> }
  | { type: "builtin"; name: string; handler: (context: Record<string, unknown>, api: BuiltinApi) => Promise<void> };

export class ActionRouter {
  private mappings = new Map<string, ActionMapping>();

  /** 注册 action 映射（来自 a2ui_render 的 actions 参数 + 模板 defaultActions） */
  register(surfaceId: string, actions: Record<string, ActionMapping>): void {
    for (const [name, mapping] of Object.entries(actions)) {
      this.mappings.set(`${surfaceId}:${name}`, mapping);
    }
  }

  /** 解析 action → 工具调用或内置行为 */
  resolve(surfaceId: string, actionName: string, context: Record<string, unknown>): ResolvedAction | null {
    const mapping = this.mappings.get(`${surfaceId}:${actionName}`);
    if (!mapping) return null;

    if (mapping.builtin) {
      const handler = builtins[mapping.builtin];
      if (!handler) return null;
      return { type: "builtin", name: mapping.builtin, handler };
    }

    if (mapping.tool) {
      const args = mapping.argMapping
        ? bindData(mapping.argMapping, { context }) as Record<string, unknown>
        : context;
      return { type: "tool", tool: mapping.tool, action: mapping.action, args };
    }

    return null;
  }

  clear(surfaceId: string): void {
    for (const key of this.mappings.keys()) {
      if (key.startsWith(`${surfaceId}:`)) this.mappings.delete(key);
    }
  }
}
