/**
 * ClawUI Preview — HTTP 路由处理器
 * 通过 api.registerHttpRoute 挂到 Gateway HTTP server 上
 * 也可独立运行：npx tsx src/server.ts
 */

import http from "node:http";
import { executeRender } from "./tool.js";
import type { ActionMapping } from "./actions/router.js";

export const VERSION = "0.4.9";

const DEFAULT_PORT = 19001;

/** 当前 JSONL + uiMeta，SSE 推送给浏览器 */
let currentJsonl = "";
let currentUiMeta: { template?: string; title?: string } = {};
/** 按 surfaceId 存储各槽位的 JSONL */
const slotJsonl = new Map<string, string>();
const sseClients = new Set<http.ServerResponse>();

function broadcast(jsonl: string, uiMeta?: { template?: string; title?: string }) {
  // 扩展消息（clawui toast/tokenUsage/frameState）不覆盖主渲染内容
  const isExtOnly = jsonl.split("\n").filter(Boolean).every(line => {
    try { return !!JSON.parse(line).clawui; } catch { return false; }
  });
  if (!isExtOnly) currentJsonl = jsonl;
  if (uiMeta) currentUiMeta = uiMeta;
  // 按 surfaceId 分拣存储
  for (const line of jsonl.split("\n").filter(Boolean)) {
    try {
      const msg = JSON.parse(line);
      const sid = msg.surfaceUpdate?.surfaceId || msg.beginRendering?.surfaceId || msg.dataModelUpdate?.surfaceId;
      if (sid) {
        const existing = slotJsonl.get(sid) || "";
        // 如果是 surfaceUpdate，替换该 slot 的全部内容
        if (msg.surfaceUpdate) slotJsonl.set(sid, line);
        else slotJsonl.set(sid, existing ? existing + "\n" + line : line);
      }
    } catch { /* skip clawui extension messages etc */ }
  }
  const payload = JSON.stringify({ jsonl, uiMeta: currentUiMeta, slots: Object.fromEntries(slotJsonl) });
  for (const res of sseClients) {
    res.write(`data: ${payload}\n\n`);
  }
}

/** action 回调：浏览器用户操作 → 这个函数 → 转发给 Agent */
let onAction: ((action: { name: string; surfaceId: string; sourceComponentId?: string; context: Record<string, unknown>; formData?: Record<string, unknown>; uiMeta?: { template?: string; title?: string } }) => void) | null = null;

/** agent 列表提供者：插件模式下由 index.ts 注入 */
let agentProvider: (() => Promise<{ id: string; name: string; description?: string }[]>) | null = null;

/** 最近一次用户输入（跨上下文共享） */
let _lastUserQuery = "";
let _queryStartTime = 0;
export function setLastUserQuery(q: string) { _lastUserQuery = q; _queryStartTime = Date.now(); }
export function getLastUserQuery(): string { return _lastUserQuery; }
export function consumeLastUserQuery(): string { const q = _lastUserQuery; _lastUserQuery = ""; return q; }
export function getQueryElapsed(): number { return _queryStartTime ? Date.now() - _queryStartTime : 0; }

/** Token 使用量追踪 */
let _sessionTokens = { input: 0, output: 0 };
let _turnTokens = { input: 0, output: 0 };

export function reportTokenUsage(input: number, output: number): void {
  _turnTokens = { input, output };
  _sessionTokens.input += input;
  _sessionTokens.output += output;
  const msg = JSON.stringify({ clawui: { tokenUsage: { turn: _turnTokens, session: _sessionTokens } } });
  broadcast(msg);
}

export function getTokenUsage() { return { turn: _turnTokens, session: _sessionTokens }; }

export function setActionHandler(handler: typeof onAction) {
  onAction = handler;
}

export function setAgentProvider(provider: typeof agentProvider) {
  agentProvider = provider;
}

export function pushToPreview(jsonl: string, uiMeta?: { template?: string; title?: string }) {
  broadcast(jsonl, uiMeta);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

import { CSS } from "./ui/styles.js";
import { clientScript } from "./ui/client.js";

function makePage(basePath: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🦞 ClawUI v${VERSION}</title>
<style>${CSS}</style>
</head>
<body>
<div class="app-header">
  <div class="brand">🦞 ClawUI</div>
  <span class="conn" id="conn">● connected</span>
  <div class="progress-line" id="progress-line"></div>
</div>
<div class="app-body" style="position:relative">
  <div class="main" id="main"></div>
  <div class="sidebar" id="sidebar">
    <div class="sidebar-meta" id="sidebar-meta">
      <div class="meta-row"><span class="meta-label">Template</span><span class="meta-value" id="meta-tpl">—</span></div>
      <div class="meta-row"><span class="meta-label">Latency</span><span class="meta-value" id="meta-latency">—</span></div>
      <div class="meta-row"><span class="meta-label">Model</span><span class="meta-value" id="meta-model">—</span></div>
      <div class="meta-row"><span class="meta-label">Turn Tokens</span><span class="meta-value" id="meta-turn-tokens">—</span></div>
      <div class="meta-row"><span class="meta-label">Session Tokens</span><span class="meta-value" id="meta-session-tokens">—</span></div>
    </div>
    <div class="sidebar-tab"><button class="active">JSONL</button><button id="copy-jsonl" class="copy-btn">Copy</button></div>
    <div class="sidebar-body" id="jsonl-view"></div>
  </div>
  <div class="sidebar-toggle" id="sidebar-toggle">◀</div>
</div>
<script>${clientScript(basePath)}</script>
</body>
</html>`;
}

/**
 * 处理 HTTP 请求 — 供 registerHttpRoute 和独立 server 共用
 */
export async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  basePath: string,
): Promise<boolean> {
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = url.pathname;

  // 去掉 basePath 前缀
  let rel = pathname;
  if (basePath && pathname.startsWith(basePath)) {
    rel = pathname.slice(basePath.length) || "/";
  }

  if (rel === "/version") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ name: "@openclaw/clawui", version: VERSION }));
    return true;
  }

  if (rel === "/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    if (currentJsonl) res.write(`data: ${JSON.stringify({ jsonl: currentJsonl, uiMeta: currentUiMeta, slots: Object.fromEntries(slotJsonl) })}\n\n`);
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return true;
  }

  if (req.method === "POST" && rel === "/push") {
    broadcast(await readBody(req));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  if (req.method === "POST" && rel === "/render") {
    try {
      const body = JSON.parse(await readBody(req));
      const result = executeRender(body);
      broadcast(result.jsonl);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, fallbackMarkdown: result.fallbackMarkdown }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
    return true;
  }

  if (req.method === "POST" && rel === "/reset") {
    currentJsonl = "";
    currentUiMeta = {};
    slotJsonl.clear();
    broadcast(JSON.stringify({ clawui: { frameState: { state: "idle" } } }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  if (req.method === "POST" && rel === "/action") {
    try {
      const body = JSON.parse(await readBody(req));
      if (body.agent === "demo" || !onAction) {
        demoHandler(body);
      } else {
        onAction(body);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, action: body.name }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
    return true;
  }

  // Agent 列表：插件模式从 agentProvider 拿，独立模式返回 demo
  if (rel === "/api/agents") {
    res.writeHead(200, { "Content-Type": "application/json" });
    const list = agentProvider ? await agentProvider() : [{ id: "demo", name: "Demo Agent", description: "ClawUI Demo 模式" }];
    res.end(JSON.stringify({ agents: list }));
    return true;
  }

  // 主页
  if (rel === "/" || rel === "") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(makePage(basePath));
    return true;
  }

  return false;
}

/** Demo 模式：独立运行时模拟 Agent 状态流转 */
function demoHandler(action: { name: string; context?: Record<string, unknown> }) {
  const text = action.context?.text as string || action.name;

  // submit → working 态
  if (action.name === "submit") {
    const headerResult = executeRender({
      slot: "header",
      components: [
        { id: "root", component: "Row", children: ["t", "s"] },
        { id: "t", component: "Text", text, variant: "h2" },
        { id: "s", component: "StatusIndicator", status: "working", text: "处理中..." },
      ],
      state: "working",
      toast: { message: "收到：" + text, type: "info" },
    });
    broadcast(headerResult.jsonl);

    const canvasResult = executeRender({
      slot: "canvas",
      components: [
        { id: "root", component: "Column", children: ["p", "msg"] },
        { id: "p", component: "ProgressBar", value: 0.3, label: "正在处理..." },
        { id: "msg", component: "Text", text: "Agent 正在处理「" + text + "」" },
      ],
    });
    broadcast(canvasResult.jsonl);

    const actionsResult = executeRender({
      slot: "actions",
      components: [
        { id: "root", component: "Row", children: ["cb"] },
        { id: "cb", component: "Button", child: "cbl", action: { event: { name: "cancel" } } },
        { id: "cbl", component: "Text", text: "取消" },
      ],
    });
    broadcast(actionsResult.jsonl);

    // 2秒后 → review 态
    setTimeout(() => {
      const h2 = executeRender({
        slot: "header",
        components: [
          { id: "root", component: "Row", children: ["t", "s"] },
          { id: "t", component: "Text", text, variant: "h2" },
          { id: "s", component: "StatusIndicator", status: "done", text: "已完成，请确认" },
        ],
        state: "review",
      });
      broadcast(h2.jsonl);

      const c2 = executeRender({
        slot: "canvas",
        components: [
          { id: "root", component: "Column", children: ["card"] },
          { id: "card", component: "Card", child: "ct", title: "处理结果" },
          { id: "ct", component: "Text", text: "已完成「" + text + "」的处理。这是 Demo 模式的模拟结果。" },
        ],
      });
      broadcast(c2.jsonl);

      const a2 = executeRender({
        slot: "actions",
        components: [
          { id: "root", component: "Row", children: ["cancel", "confirm"] },
          { id: "cancel", component: "Button", child: "cl", action: { event: { name: "cancel" } } },
          { id: "cl", component: "Text", text: "取消" },
          { id: "confirm", component: "Button", child: "cfl", action: { event: { name: "confirm" } } },
          { id: "cfl", component: "Text", text: "确认" },
        ],
      });
      broadcast(a2.jsonl);
    }, 2000);
    return;
  }

  // confirm → done 态，3秒后回 idle
  if (action.name === "confirm") {
    slotJsonl.clear();
    const h = executeRender({
      slot: "header",
      components: [
        { id: "root", component: "StatusIndicator", status: "done", text: "完成" },
      ],
      state: "done",
      toast: { message: "操作已完成", type: "success" },
    });
    broadcast(h.jsonl);

    const c = executeRender({
      slot: "canvas",
      components: [
        { id: "root", component: "Column", children: ["icon", "msg"] },
        { id: "icon", component: "Text", text: "✅ 已完成", variant: "h1" },
        { id: "msg", component: "Text", text: "Demo 模式演示结束。3 秒后返回首页。" },
      ],
    });
    broadcast(c.jsonl);

    // 清空 actions
    slotJsonl.delete("main:actions");

    setTimeout(() => {
      slotJsonl.clear();
      broadcast(JSON.stringify({ clawui: { frameState: { state: "idle" } } }));
    }, 3000);
    return;
  }

  // cancel → 回 idle
  if (action.name === "cancel") {
    slotJsonl.clear();
    broadcast(JSON.stringify({ clawui: { frameState: { state: "idle" } } }));
    return;
  }
}

/** 独立 HTTP server（开发用 / fallback） */
export function startServer(port = DEFAULT_PORT): http.Server {
  const server = http.createServer(async (req, res) => {
    const handled = await handleRequest(req, res, "");
    if (!handled) {
      res.writeHead(404);
      res.end("not found");
    }
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`⚠️  ClawUI Preview Server: port ${port} already in use, skipping`);
    } else {
      console.warn(`⚠️  ClawUI Preview Server error: ${err.message}`);
    }
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`🦞 ClawUI Preview Server: http://localhost:${port}`);
  });

  return server;
}

// 独立运行
const isMain = !process.argv[1] || process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js");
if (isMain && import.meta.url.endsWith(process.argv[1]?.replace(/.*[/\\]/, "") || "")) {
  (async () => {
    const { registerAll } = await import("./templates/registry.js");
    const mods = await Promise.all([
      import("./templates/builtin/text_display.json", { with: { type: "json" } }),
      import("./templates/builtin/form.json", { with: { type: "json" } }),
      import("./templates/builtin/confirmation.json", { with: { type: "json" } }),
      import("./templates/builtin/booking_form.json", { with: { type: "json" } }),
      import("./templates/builtin/search_results.json", { with: { type: "json" } }),
      import("./templates/builtin/dashboard.json", { with: { type: "json" } }),
      import("./templates/builtin/settings.json", { with: { type: "json" } }),
      import("./templates/builtin/accordion.json", { with: { type: "json" } }),
    ]);
    registerAll(mods.map(m => m.default) as any);
    startServer();
  })();
}
