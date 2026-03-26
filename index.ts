/**
 * ClawUI — OpenClaw 插件入口
 */

import { registerAll, loadFromDir } from "./src/templates/registry.js";
import { executeRender, actionRouter } from "./src/tool.js";
import type { A2UIRenderParams } from "./src/tool.js";
import * as registry from "./src/templates/registry.js";
import { registerCli } from "./src/cli.js";
import { pushToPreview, setActionHandler, setAgentProvider, startServer, setLastUserQuery, consumeLastUserQuery, getQueryElapsed, reportTokenUsage } from "./src/server.js";
import { handleUserAction } from "./src/actions/agent-loop.js";
import { IntentMatcher, type RagConfig } from "./src/rag/matcher.js";
import { Type } from "@sinclair/typebox";

import { pushSkeleton, stopProgressStages, pushDoneHeader, pushTemplateSkeleton } from "./src/skeleton/skeleton.js";
import { liteRender } from "./src/lite-render.js";
import { TOOL_DESCRIPTION, toolRoutePrompt, ragReplayPrompt } from "./src/prompts/index.js";

import { randomUUID } from "node:crypto";

// 内置模板
import textDisplay from "./src/templates/builtin/text_display.json" with { type: "json" };
import form from "./src/templates/builtin/form.json" with { type: "json" };
import confirmation from "./src/templates/builtin/confirmation.json" with { type: "json" };
import bookingForm from "./src/templates/builtin/booking_form.json" with { type: "json" };
import searchResults from "./src/templates/builtin/search_results.json" with { type: "json" };
import dashboard from "./src/templates/builtin/dashboard.json" with { type: "json" };
import settings from "./src/templates/builtin/settings.json" with { type: "json" };
import accordion from "./src/templates/builtin/accordion.json" with { type: "json" };
import dataTable from "./src/templates/builtin/data_table.json" with { type: "json" };
import statusPage from "./src/templates/builtin/status_page.json" with { type: "json" };
import detail from "./src/templates/builtin/detail.json" with { type: "json" };
import multiCard from "./src/templates/builtin/multi_card.json" with { type: "json" };
import homeScreen from "./src/templates/builtin/home_screen.json" with { type: "json" };
import skillList from "./src/templates/builtin/skill_list.json" with { type: "json" };
import fileBrowser from "./src/templates/builtin/file_browser.json" with { type: "json" };

registerAll([textDisplay, form, confirmation, bookingForm, searchResults, dashboard, settings, accordion, dataTable, statusPage, detail, multiCard, homeScreen, skillList, fileBrowser] as any);

import type { LiteRenderResult } from "./src/lite-render.js";

/** 流式预渲染状态 */
interface PreRenderState {
  id: string;
  intent: string;
  toolResults: string[];
  preRendered: boolean;
  liteResult?: LiteRenderResult;
  _timer?: ReturnType<typeof setTimeout>;
  _partialBuf?: string;
  _uiHintParsed?: boolean;
}

const STREAMING_PRE_RENDER = true;
const preRenderStates = new Map<string, PreRenderState>();

/** 从渲染参数提取摘要文本，用于 RAG 学习 */
function extractLearnText(p: A2UIRenderParams): string {
  if (p.template && p.data?.title) return `${p.template}: ${p.data.title}`;
  if (p.template) return p.template;
  const comps = p.components;
  if (!Array.isArray(comps)) return "";
  const texts: string[] = [];
  for (const c of comps) {
    if (texts.length >= 3) break;
    const t = typeof c.text === "string" ? c.text : c.text?.literalString;
    if (t && t.length > 2) texts.push(t);
    const title = typeof c.title === "string" ? c.title : c.title?.literalString;
    if (title && title.length > 2) texts.push(title);
  }
  return texts.join(" ").slice(0, 200);
}

const A2UIRenderSchema = Type.Object({
  template: Type.Optional(Type.String({ description: "Template name (e.g. 'form', 'data_table', 'status_page')" })),
  templates: Type.Optional(Type.Array(Type.Object({
    template: Type.String({ description: "Template name" }),
    data: Type.Optional(Type.Record(Type.String(), Type.Any())),
  }), { description: "Combine multiple templates into one page" })),
  components: Type.Optional(Type.Array(Type.Any(), { description: "Custom A2UI components (fallback, prefer templates)" })),
  data: Type.Optional(Type.Record(Type.String(), Type.Any(), { description: "Data to fill into the template" })),
  actions: Type.Optional(Type.Record(Type.String(), Type.Any(), { description: "Action name → tool mapping" })),
  surfaceId: Type.Optional(Type.String({ description: "Surface ID (default: auto from slot)" })),
  slot: Type.Optional(Type.String({ description: "Target slot: header | canvas | actions | context (default: canvas)" })),
  state: Type.Optional(Type.String({ description: "Task state transition: idle | working | review | done | error" })),
  toast: Type.Optional(Type.Object({
    message: Type.String(),
    type: Type.Optional(Type.String({ description: "success | info | warning | error" })),
    duration: Type.Optional(Type.Number({ description: "Duration in ms (default: 3000)" })),
  }, { description: "Show a toast notification" })),
  fallback: Type.Optional(Type.String({ description: "Fallback mode: 'auto' or custom markdown text" })),
  rawData: Type.Optional(Type.String({ description: "Raw text data — ClawUI auto-selects template and formats (faster, skips manual template selection)" })),
  intent: Type.Optional(Type.String({ description: "User intent hint for rawData mode (e.g. 'show weather as table')" })),
}, { additionalProperties: false });

const plugin = {
  id: "clawui",
  name: "ClawUI",
  description: "High-level A2UI interface generation for AI agents",
  configSchema: Type.Object({
    defaultSurfaceId: Type.Optional(Type.String({ default: "main" })),
    enableFallback: Type.Optional(Type.Boolean({ default: true })),
    customTemplatesDir: Type.Optional(Type.String()),
    previewPort: Type.Optional(Type.Number({ default: 19000 })),
  }),

  register(api: any) {
    // 加载自定义模板
    const customDir = api.pluginConfig?.customTemplatesDir;
    if (customDir) {
      const dir = customDir.replace(/^~/, process.env.HOME || "");
      loadFromDir(dir);
    }

    /**
     * RAG 开关：设为 false 禁用全部 RAG 功能（embedding + S3 + 匹配 + 学习）
     */
    const RAG_ENABLED = false;

    /**
     * RAG 策略（仅 RAG_ENABLED=true 时生效）：
     * - "full"   : 命中后直接返回缓存的完整页面（快，但数据可能过期）
     * - "replay" : 命中后把用户原始查询重新发给 Agent（稍慢，但数据实时）
     */
    const RAG_STRATEGY: "full" | "replay" = "replay";

    // RAG 意图匹配器
    let matcher: IntentMatcher | null = null;
    if (RAG_ENABLED) {
      matcher = new IntentMatcher({
        enabled: true,
        embedder: { region: "us-east-1", dimension: 1024 },
        store: { region: "us-east-1", bucket: "clawui-rag-store" },
        threshold: 0.60,
      });
      matcher.init().then(() => {
        api.logger?.info?.(`ClawUI RAG enabled [${RAG_STRATEGY}]: entries=${matcher!.size}`);
      }).catch((e: any) => {
        api.logger?.error?.(`ClawUI RAG init failed: ${e.message}, disabling`);
        api.logger?.error?.(`ClawUI RAG debug: AWS credentials ${process.env.AWS_ACCESS_KEY_ID ? "configured" : "missing"}`);
        matcher = null;
      });
    }

    // 启动 Preview Server（独立 HTTP）
    startServer(api.pluginConfig?.previewPort);

    // 解析默认 agentId（从 config 读取，fallback "main"）
    let defaultAgentId = "main";
    try {
      const cfg = api.runtime?.config?.loadConfig?.() || api.pluginConfig?._rootConfig;
      const cfgDefault = cfg?.agents?.defaults?.agentId || cfg?.acp?.defaultAgent;
      if (cfgDefault) defaultAgentId = cfgDefault;
      // 也尝试从 agent list 拿第一个
      if (defaultAgentId === "main") {
        const agents = cfg?.agents?.list;
        if (Array.isArray(agents) && agents.length && agents[0].id) defaultAgentId = agents[0].id;
      }
    } catch {}
    api.logger?.info?.(`ClawUI defaultAgentId: "${defaultAgentId}"`);

    // agent 列表提供者（从 Gateway API 拿）
    setAgentProvider(async () => {
      try {
        const list = await api.runtime?.agents?.list?.();
        if (Array.isArray(list)) return list.map((a: any) => ({ id: a.id || a.name, name: a.name || a.id, description: a.description || a.model || "" }));
      } catch {}
      // 从 config 读 agent 列表
      try {
        const cfg = api.runtime.config.loadConfig();
        const agents = cfg?.agents?.list;
        if (Array.isArray(agents) && agents.length) {
          return agents.map((a: any) => ({ id: a.id, name: a.name || a.id, description: a.description || "" }));
        }
      } catch {}
      return [{ id: defaultAgentId, name: defaultAgentId, description: "" }];
    });

    // action 回调：先查 ActionRouter 声明式映射，没有则走 Agent 自然语言决策
    let sessionKey = "";

    /** 发消息给 Agent */
    const agentSessions = new Map<string, string>(); // agentId → sessionId
    async function sendToAgent(message: string, preRender?: PreRenderState) {
      const t0 = Date.now();
      let resolvedAgentId = defaultAgentId;
      if (!sessionKey) {
        try {
          const cfg = api.runtime.config.loadConfig();
          const bindings = cfg?.routing || [];
          const boundChannel = bindings.length ? bindings[0].match?.channel : null;
          const channel = boundChannel || "discord";
          const route = api.runtime.channel.routing.resolveAgentRoute({
            cfg,
            channel,
            peer: { kind: "direct", id: "clawui-preview" },
          });
          if (route?.sessionKey) sessionKey = route.sessionKey;
          if (route?.agentId) resolvedAgentId = route.agentId;
          api.logger?.info?.(`ClawUI route via channel="${channel}" → sessionKey="${sessionKey}", agentId="${resolvedAgentId}"`);
        } catch (e: any) {
          api.logger?.warn?.(`ClawUI resolveAgentRoute failed: ${e.message}`);
        }
      }

      // 方式1: subagent.run（仅 Gateway request 上下文）
      try {
        const t1 = Date.now();
        api.logger?.info?.(`ClawUI timing: route resolved in ${t1 - t0}ms`);
        await api.runtime.subagent.run({ sessionKey, message });
        api.logger?.info?.(`ClawUI timing: subagent.run total ${Date.now() - t0}ms (LLM ${Date.now() - t1}ms) [pre-render SKIPPED - subagent path]`);
        return;
      } catch {
        api.logger?.info?.(`ClawUI subagent.run not available, falling back to runEmbeddedPiAgent`);
      }

      // 方式2: runEmbeddedPiAgent（复用 session）
      try {
        const cfg = api.runtime.config.loadConfig();
        const agentCfg = (cfg?.agents?.list || []).find((a: any) => a.id === resolvedAgentId) || {};
        const model = agentCfg.model?.primary || cfg?.agents?.defaults?.model?.primary || "";
        const provider = model.split("/")[0] || undefined;
        const modelId = model.split("/").slice(1).join("/") || undefined;
        const agentDir = agentCfg.agentDir || api.runtime.agent.resolveAgentDir(resolvedAgentId);
        const workspaceDir = agentCfg.workspace || cfg?.agents?.defaults?.workspace || process.env.HOME || "/tmp";
        // 复用 session：同一个 agentId 用同一个 sessionId
        let sessionId = agentSessions.get(resolvedAgentId);
        if (!sessionId) {
          sessionId = randomUUID();
          agentSessions.set(resolvedAgentId, sessionId);
        }
        const sessionFile = api.runtime.agent.session.resolveSessionFilePath(sessionId, { agentId: resolvedAgentId });

        api.logger?.info?.(`ClawUI runEmbeddedPiAgent: agent=${resolvedAgentId} model=${model} sessionId=${sessionId}`);
        const t2 = Date.now();
        api.logger?.info?.(`ClawUI timing: agent setup in ${t2 - t0}ms`);

        await api.runtime.agent.runEmbeddedPiAgent({
          sessionId,
          sessionKey,
          agentId: resolvedAgentId,
          sessionFile,
          workspaceDir,
          agentDir,
          config: cfg,
          prompt: message,
          provider,
          model: modelId,
          trigger: "clawui",
          messageChannel: "clawui",
          timeoutMs: 120_000,
          runId: `clawui-${Date.now()}${preRender ? `-${preRender.id}` : ""}`,
          onPartialReply: preRender ? (payload) => {
            if (preRender._uiHintParsed || !payload.text) return;
            // 累积文本，检测 [UI:template|count|title]
            preRender._partialBuf = (preRender._partialBuf || "") + payload.text;
            const m = preRender._partialBuf.match(/\[UI:([a-z_]+)\|(\d+)\|([^\]]+)\]/);
            if (m) {
              preRender._uiHintParsed = true;
              const [, template, countStr, title] = m;
              const count = parseInt(countStr) || 3;
              api.logger?.info?.(`ClawUI UI hint: template=${template}, count=${count}, title=${title}`);
              pushTemplateSkeleton(template, count, title);
            }
          } : undefined,
          shouldEmitToolOutput: preRender ? () => true : undefined,
          onToolResult: preRender ? async (payload) => {
            api.logger?.info?.(`ClawUI onToolResult fired: text=${payload.text?.length || 0} chars, preview="${payload.text?.slice(0, 150)}", preRendered=${preRender.preRendered}`);
            if (preRender.preRendered || !payload.text || payload.text.length < 50) return;
            // 跳过 a2ui_render / 工具摘要
            if (payload.text.includes("a2ui_push") || payload.text.includes("A2UI JSONL")) return;
            if (payload.text.startsWith("\ud83d\udd27") || payload.text.startsWith("Tool ")) return;
            // 收集结果，延迟触发预渲染（等更多工具结果到达）
            preRender.toolResults.push(payload.text);
            if (!preRender._timer) {
              preRender._timer = setTimeout(async () => {
                if (preRender.preRendered) return;
                preRender.preRendered = true;
                // 用最长的工具结果（最可能是实际数据）
                const best = preRender.toolResults.sort((a, b) => b.length - a.length)[0];
                api.logger?.info?.(`ClawUI pre-render: using best result (${best.length} chars of ${preRender.toolResults.length} results)`);
                try {
                  const lite = await liteRender(best, preRender.intent, { region: "us-east-1" });
                  preRender.liteResult = lite;
                  const rendered = executeRender({ template: lite.template, data: lite.data });
                  stopProgressStages();
                  pushToPreview(rendered.jsonl, { template: lite.template, title: lite.data?.title as string });
                  pushDoneHeader(lite.data?.title as string || lite.template || "完成");
                  reportTokenUsage(lite.inputTokens, lite.outputTokens);
                  api.logger?.info?.(`ClawUI pre-render: ${lite.ms}ms, template=${lite.template}`);
                } catch (e: any) {
                  preRender.preRendered = false;
                  api.logger?.warn?.(`ClawUI pre-render failed: ${e.message}`);
                }
              }, 2000);
            }
          } : undefined,
        });
        api.logger?.info?.(`ClawUI timing: runEmbeddedPiAgent total ${Date.now() - t0}ms (LLM+tools ${Date.now() - t2}ms)`);
      } catch (e: any) {
        api.logger?.error?.(`ClawUI runEmbeddedPiAgent failed (${Date.now() - t0}ms): ${e.message}`);
      }
    }

    /** surfaceId → 最近一次渲染的语义信息 */
    const surfaceMeta = new Map<string, { template?: string; title?: string; model?: string }>();

    setActionHandler((action) => {
      // 1. 先尝试声明式路由
      const resolved = actionRouter.resolve(
        action.surfaceId || "main",
        action.name,
        { ...action.context, formData: action.formData },
      );

      if (resolved?.type === "builtin") {
        resolved.handler(action.context || {}, {
          canvasReset: async (sid) => api.runtime?.canvas?.reset?.(sid),
          canvasNavigate: async (sid, url) => api.runtime?.canvas?.navigate?.(sid, url),
          agentPrompt: async (text) => sendToAgent(text),
        });
        return;
      }

      if (resolved?.type === "tool") {
        const msg = toolRoutePrompt(action.name, resolved.tool, resolved.args);
        sendToAgent(msg);
        return;
      }

      // 2. RAG 意图匹配（submit 时尝试）
      const userText = (action.context?.text as string) || "";
      if (matcher && action.name === "submit" && userText) {
        setLastUserQuery(userText);
        const ragStart = Date.now();
        matcher.match(userText).then((result) => {
          const ragMs = Date.now() - ragStart;
          if (result.hit && result.entry) {
            api.logger?.info?.(`ClawUI RAG hit [${RAG_STRATEGY}]: "${userText}" → score=${result.score?.toFixed(3)}, ${ragMs}ms`);

            if (RAG_STRATEGY === "full") {
              // 策略1: 直接返回缓存页面
              const cached = result.entry.renderResult as A2UIRenderParams;
              const rendered = executeRender(cached);
              const toastMsg = JSON.stringify({ clawui: { toast: { message: `\u26a1 RAG \u547d\u4e2d (${ragMs}ms) | \u76f8\u4f3c\u5ea6 ${(result.score! * 100).toFixed(0)}% | 0 tokens`, type: "success", duration: 4000 } } });
              const stateMsg = JSON.stringify({ clawui: { frameState: { state: "review" } } });
              pushToPreview(toastMsg + "\n" + stateMsg + "\n" + rendered.jsonl, surfaceMeta.get(action.surfaceId || "main"));
            } else {
              // 策略2: replay — 用用户原始查询重新发给 Agent，拿最新数据
              const replayQuery = result.entry.userQuery || userText;
              const toastMsg = JSON.stringify({ clawui: { toast: { message: `\u26a1 RAG \u547d\u4e2d (${ragMs}ms) | replay \u6a21\u5f0f | \u91cd\u65b0\u62c9\u53d6\u6570\u636e...`, type: "success", duration: 3000 } } });
              pushToPreview(toastMsg);
              sendToAgent(ragReplayPrompt(replayQuery));
            }
            return;
          }
          api.logger?.info?.(`ClawUI RAG miss: "${userText}" (${ragMs}ms)`);
          const toastMsg = JSON.stringify({ clawui: { toast: { message: `\ud83e\udd16 RAG \u672a\u547d\u4e2d (${ragMs}ms)\uff0c\u8f6c LLM \u5904\u7406...`, type: "info", duration: 3000 } } });
          pushToPreview(toastMsg);
          fallbackToAgent(action);
        }).catch(() => fallbackToAgent(action));
        return;
      }

      // 3. 无映射 → Agent 自然语言决策
      fallbackToAgent(action);
    });

    function fallbackToAgent(action: any) {
      const meta = surfaceMeta.get(action.surfaceId || "main");
      const userText = (action.context?.text as string) || "";
      // 创建预渲染状态，用唯一 ID 关联
      let preRender: PreRenderState | undefined;
      if (STREAMING_PRE_RENDER) {
        const id = `pr-${Date.now()}`;
        preRender = { id, intent: userText, toolResults: [], preRendered: false };
        preRenderStates.set(id, preRender);
        // 清理超过 60s 的旧状态
        for (const [k, s] of preRenderStates) { if (Date.now() - parseInt(k.slice(3)) > 60000) preRenderStates.delete(k); }
        api.logger?.info?.(`ClawUI pre-render: state created id=${id}, intent="${userText}"`);
      }
      // 立即推送骨架屏，不等 Agent
      pushSkeleton(meta || { title: userText || undefined });
      handleUserAction(
        {
          name: action.name,
          surfaceId: action.surfaceId || "main",
          sourceComponentId: action.sourceComponentId,
          context: action.context || {},
          formData: action.formData,
          uiMeta: meta || action.uiMeta,
        },
        {
          runAgent: (message) => sendToAgent(message, preRender),
          logger: api.logger,
        },
      );
    }

    // 1. 注册 Agent Tool
    api.registerTool({
      name: "a2ui_render",
      label: "A2UI Render",
      description: TOOL_DESCRIPTION,
      parameters: A2UIRenderSchema,
      execute: async (_toolCallId: string, params: unknown, context?: any) => {
        // 捕获真实 sessionKey（在 Gateway request 上下文中）
        const capturedKey = context?.sessionKey || context?.session?.key || context?.session?.id;
        if (capturedKey) {
          sessionKey = capturedKey;
          api.logger?.info?.(`ClawUI captured sessionKey: ${sessionKey}`);
        } else {
          // 尝试从 runtime 获取
          try {
            const runtimeSession = api.runtime?.session?.key || api.runtime?.session?.id || api.runtime?.sessionKey;
            if (runtimeSession) {
              sessionKey = runtimeSession;
              api.logger?.info?.(`ClawUI captured sessionKey from runtime: ${sessionKey}`);
            } else {
              api.logger?.info?.(`ClawUI no sessionKey in context or runtime. context keys: ${context ? Object.keys(context) : "none"}`);
            }
          } catch {}
        }
        stopProgressStages();
        const p = params as A2UIRenderParams;
        // 流式预渲染去重: 找最近的已完成预渲染状态
        const matchedPre = [...preRenderStates.values()].find(s => s.preRendered && s.liteResult);
        api.logger?.info?.(`ClawUI a2ui_render: matchedPre=${matchedPre ? `id=${matchedPre.id}, preRendered=${matchedPre.preRendered}, hasLite=${!!matchedPre.liteResult}` : "null"}, hasRawData=${!!(p as any).rawData}`);
        if (STREAMING_PRE_RENDER && matchedPre?.liteResult && (p as any).rawData) {
          const lite = matchedPre.liteResult;
          api.logger?.info?.(`ClawUI skip duplicate liteRender, using pre-render: ${lite.template} (${lite.ms}ms)`);
          preRenderStates.delete(matchedPre.id);
          return {
            content: [{ type: "text", text: "UI already rendered via streaming pre-render." }],
          };
        }
        if (matchedPre) preRenderStates.delete(matchedPre.id);
        // rawData 模式: Agent 只传原始数据，liteRender 自动选模板+格式化
        if ((p as any).rawData) {
          try {
            const lite = await liteRender((p as any).rawData, (p as any).intent || "", { region: "us-east-1" });
            api.logger?.info?.(`ClawUI liteRender: ${lite.ms}ms, in=${lite.inputTokens}, out=${lite.outputTokens}, template=${lite.template}`);
            p.template = lite.template;
            p.data = lite.data;
            // 上报 lite 的 token 用量
            reportTokenUsage(lite.inputTokens, lite.outputTokens);
          } catch (e: any) {
            api.logger?.error?.(`ClawUI liteRender failed: ${e.message}, falling back to text_display`);
            p.template = "text_display";
            p.data = { title: (p as any).intent || "结果", text: (p as any).rawData };
          }
        }
        const result = executeRender(p);
        const sid = p.surfaceId || "main";
        // 记录当前 surface 的语义信息，供 action 回调生成自然语言
        const agentCfg2 = (() => { try { const c = api.runtime?.config?.loadConfig?.(); const aid = context?.agentId || ""; return { model: (c?.agents?.list || []).find((a: any) => a.id === aid)?.model?.primary || c?.agents?.defaults?.model?.primary || "" }; } catch { return { model: "" }; } })();
        surfaceMeta.set(sid, {
          template: p.template || (p.templates ? p.templates.map((t: any) => t.template).join("+") : undefined),
          title: (p.data?.title as string) || undefined,
          model: agentCfg2.model || undefined,
        });
        pushToPreview(result.jsonl, surfaceMeta.get(sid));
        pushDoneHeader((p.data?.title as string) || p.template || "完成");
        // 推送端到端耗时 toast
        const e2eMs = getQueryElapsed();
        if (e2eMs > 0) {
          const e2eToast = JSON.stringify({ clawui: { toast: { message: `\u23f1 \u7aef\u5230\u7aef ${(e2eMs/1000).toFixed(1)}s | LLM \u6e32\u67d3`, type: "info", duration: 4000 } } });
          pushToPreview(e2eToast);
        }
        // Token usage: 从 context 读取，fallback 用 JSONL 长度估算
        const usage = context?.usage || context?.tokenUsage;
        const inputTokens = usage?.inputTokens || usage?.input || Math.round(result.jsonl.length / 4);
        const outputTokens = usage?.outputTokens || usage?.output || Math.round(result.jsonl.length / 4);
        reportTokenUsage(inputTokens, outputTokens);
        // RAG 学习：优先用用户原始输入，fallback 到渲染摘要
        if (matcher) {
          const userQ = consumeLastUserQuery();
          const extracted = extractLearnText(p);
          const learnText = userQ || extracted;
          api.logger?.info?.(`ClawUI RAG learn: userQ="${userQ}", extracted="${extracted}", components=${Array.isArray(p.components) ? p.components.length : "none"}`);
          if (learnText) {
            matcher.learn(learnText, p, context?.agentId as string || "unknown").then(() => {
              api.logger?.info?.(`ClawUI RAG learned: "${learnText}"`);
            }).catch((e: any) => {
              api.logger?.error?.(`ClawUI RAG learn failed: ${e.message}`);
            });
          }
        }
        return {
          content: [{
            type: "text",
            text: [
              "A2UI JSONL generated. Push it with the canvas tool:",
              `canvas({ action: "a2ui_push", jsonl: <the JSONL below> })`,
              "",
              result.jsonl,
              "",
              result.fallbackMarkdown ? `Fallback markdown:\n${result.fallbackMarkdown}` : "",
            ].filter(Boolean).join("\n"),
          }],
        };
      },
    });

    // 2. 注册 CLI 命令
    api.registerCli(({ program }: any) => registerCli(program), { commands: ["clawui"] });

    // 3. 注册 Gateway RPC
    api.registerGatewayMethod("clawui.templates", ({ respond }: any) => {
      respond(true, { templates: registry.list() });
    });

    api.registerGatewayMethod("clawui.render", ({ respond, params }: any) => {
      const p = params as A2UIRenderParams;
      const result = executeRender(p);
      surfaceMeta.set(p.surfaceId || "main", {
        template: p.template,
        title: (p.data?.title as string) || undefined,
      });
      pushToPreview(result.jsonl, surfaceMeta.get(p.surfaceId || "main"));
      respond(true, result);
    });

    // clawui.action — 在 Gateway 上下文中执行 action
    api.registerGatewayMethod("clawui.action", async ({ respond, params }: any) => {
      try {
        const message = params?.message as string;
        if (!message) { respond(true, { ok: true }); return; }
        await api.runtime.subagent.run({ sessionKey, message });
        respond(true, { ok: true });
      } catch (e: any) {
        api.logger?.error?.(`ClawUI clawui.action failed: ${e}`);
        respond(false, { error: String(e) });
      }
    });
  },
};

export default plugin;
