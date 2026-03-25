/**
 * 内置 action 定义
 */

export type BuiltinHandler = (context: Record<string, unknown>, api: BuiltinApi) => Promise<void>;

export interface BuiltinApi {
  canvasReset: (surfaceId: string) => Promise<void>;
  canvasNavigate: (surfaceId: string, url: string) => Promise<void>;
  agentPrompt: (text: string) => Promise<void>;
}

export const builtins: Record<string, BuiltinHandler> = {
  "surface.close": async (_ctx, api) => {
    await api.canvasReset(_ctx.surfaceId as string || "main");
  },
  "surface.navigate": async (ctx, api) => {
    await api.canvasNavigate(ctx.surfaceId as string || "main", ctx.url as string);
  },
  "agent.prompt": async (ctx, api) => {
    await api.agentPrompt(JSON.stringify(ctx));
  },
};
