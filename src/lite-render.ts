/**
 * 轻量 LLM 渲染器 — 跳过完整 Agent，直接调 Bedrock 把原始数据转成模板参数
 * 
 * 输入: 非结构化文本（web_search 结果等）+ 用户意图
 * 输出: { template, data } JSON
 * 
 * 目标: ~500 input tokens, ~1.5s（vs 完整 Agent 的 ~4200 input, ~3.7s）
 */

import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { LITE_RENDER_SYSTEM } from "./prompts/index.js";

let client: BedrockRuntimeClient | null = null;

export interface LiteRenderConfig {
  region?: string;
  model?: string;
}

const DEFAULT_MODEL = "us.anthropic.claude-haiku-4-5-20251001-v1:0";

function getClient(region: string): BedrockRuntimeClient {
  if (!client) client = new BedrockRuntimeClient({ region });
  return client;
}

export interface LiteRenderResult {
  template: string;
  data: Record<string, unknown>;
  inputTokens: number;
  outputTokens: number;
  ms: number;
}

/**
 * 轻量渲染: 原始文本 → { template, data }
 * @param rawData - 工具返回的原始文本
 * @param intent - 用户意图（一句话）
 */
export async function liteRender(
  rawData: string,
  intent: string,
  cfg?: LiteRenderConfig,
): Promise<LiteRenderResult> {
  const region = cfg?.region || "us-east-1";
  const model = cfg?.model || DEFAULT_MODEL;
  const t0 = Date.now();

  const userMsg = intent
    ? `用户想要: ${intent}\n\n数据:\n${rawData}`
    : `数据:\n${rawData}`;

  const r = await getClient(region).send(new ConverseCommand({
    modelId: model,
    system: [{ text: LITE_RENDER_SYSTEM }],
    messages: [{ role: "user", content: [{ text: userMsg }] }],
    toolConfig: {
      tools: [{
        toolSpec: {
          name: "render",
          description: "Output the template and data",
          inputSchema: { json: {
            type: "object",
            properties: {
              template: { type: "string" },
              data: { type: "object" },
            },
            required: ["template", "data"],
          }},
        },
      }],
      toolChoice: { tool: { name: "render" } },
    },
  }));

  // toolUse 返回的直接是合法 JSON 对象
  const content = r.output?.message?.content || [];
  const toolBlock = content.find((b: any) => b.toolUse);
  const parsed = toolBlock?.toolUse?.input as { template?: string; data?: Record<string, unknown> } || {};

  return {
    template: parsed.template || "text_display",
    data: parsed.data || {},
    inputTokens: r.usage?.inputTokens || 0,
    outputTokens: r.usage?.outputTokens || 0,
    ms: Date.now() - t0,
  };
}
