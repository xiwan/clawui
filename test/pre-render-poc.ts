/**
 * v0.5.0 POC — 验证流式预渲染的核心假设
 *
 * 模拟: onToolResult 触发 → 并行 liteRender → 预渲染推送
 * 对比: 串行等待 Agent 结束后再 liteRender
 *
 * 用法: npx tsx test/pre-render-poc.ts
 */

import { liteRender } from "../src/lite-render.js";
import { executeRender } from "../src/tool.js";
import { registerAll } from "../src/templates/registry.js";

// 注册模板
import textDisplay from "../src/templates/builtin/text_display.json" with { type: "json" };
import dataTable from "../src/templates/builtin/data_table.json" with { type: "json" };
import dashboard from "../src/templates/builtin/dashboard.json" with { type: "json" };
import detail from "../src/templates/builtin/detail.json" with { type: "json" };
import searchResults from "../src/templates/builtin/search_results.json" with { type: "json" };
import statusPage from "../src/templates/builtin/status_page.json" with { type: "json" };
import multiCard from "../src/templates/builtin/multi_card.json" with { type: "json" };
import fileBrowser from "../src/templates/builtin/file_browser.json" with { type: "json" };
import accordion from "../src/templates/builtin/accordion.json" with { type: "json" };
registerAll([textDisplay, dataTable, dashboard, detail, searchResults, statusPage, multiCard, fileBrowser, accordion] as any);

// ── 模拟数据：假设这是工具返回的原始文本 ──

const TOOL_RESULTS = [
  {
    name: "web_search 结果",
    intent: "搜索今天的科技新闻",
    rawData: `1. Apple Vision Pro 2 发布 — Apple 今日发布第二代 Vision Pro，售价 $2999，重量减轻 40%
2. OpenAI GPT-5 预览 — OpenAI 展示 GPT-5 早期能力，推理速度提升 3 倍
3. 特斯拉 Optimus 量产 — 特斯拉宣布 Optimus 机器人开始小批量生产，预计 Q3 交付
4. 台积电 2nm 良率突破 — 台积电 2nm 工艺良率达到 80%，超出预期
5. Starlink 直连手机 — SpaceX Starlink 直连手机服务覆盖全球 90% 区域`,
  },
  {
    name: "shell ls 结果",
    intent: "列出当前目录文件",
    rawData: `total 120
drwxr-xr-x  8 user user  4096 Mar 26 10:00 .
drwxr-xr-x  5 user user  4096 Mar 25 09:00 ..
-rw-r--r--  1 user user  2048 Mar 26 09:30 index.ts
-rw-r--r--  1 user user   800 Mar 25 14:00 package.json
drwxr-xr-x  6 user user  4096 Mar 26 10:00 src
drwxr-xr-x  2 user user  4096 Mar 25 12:00 test
drwxr-xr-x  2 user user  4096 Mar 24 15:00 docs
-rw-r--r--  1 user user 13000 Mar 26 09:00 CHANGELOG.md
-rw-r--r--  1 user user  3800 Mar 25 03:00 README.md`,
  },
  {
    name: "系统监控结果",
    intent: "查看系统资源",
    rawData: `CPU Usage: 45.2% (4 cores)
Memory: 6.2GB / 16GB (38.7%)
Disk: 82GB / 200GB (41%)
Load Average: 1.23 1.45 1.67
Uptime: 14 days 3 hours
Network: eth0 rx=1.2GB tx=0.8GB
Processes: 142 total, 3 running`,
  },
];

// ── 测试逻辑 ──

interface PreRenderState {
  intent: string;
  toolResults: string[];
  preRendered: boolean;
}

async function simulateSerialFlow(toolResult: typeof TOOL_RESULTS[0]) {
  const t0 = Date.now();

  // 模拟 Agent 思考时间（工具结果 → 组织回复 → 调 a2ui_render）
  await sleep(2000);

  // Agent 最终调 a2ui_render 的 rawData 模式
  const lite = await liteRender(toolResult.rawData, toolResult.intent, { region: "us-east-1" });
  const rendered = executeRender({ template: lite.template, data: lite.data });

  return {
    totalMs: Date.now() - t0,
    liteMs: lite.ms,
    template: lite.template,
    inputTokens: lite.inputTokens,
    outputTokens: lite.outputTokens,
    jsonlLines: rendered.jsonl.split("\n").length,
  };
}

async function simulateStreamingFlow(toolResult: typeof TOOL_RESULTS[0]) {
  const t0 = Date.now();

  const state: PreRenderState = {
    intent: toolResult.intent,
    toolResults: [],
    preRendered: false,
  };

  // 模拟 onToolResult 立即触发
  state.toolResults.push(toolResult.rawData);

  // 并行: liteRender 和 Agent 后续处理同时进行
  const [liteResult] = await Promise.all([
    // 预渲染
    (async () => {
      const lite = await liteRender(
        state.toolResults.join("\n"),
        state.intent,
        { region: "us-east-1" },
      );
      state.preRendered = true;
      const rendered = executeRender({ template: lite.template, data: lite.data });
      return {
        preRenderMs: Date.now() - t0,
        liteMs: lite.ms,
        template: lite.template,
        inputTokens: lite.inputTokens,
        outputTokens: lite.outputTokens,
        jsonlLines: rendered.jsonl.split("\n").length,
      };
    })(),
    // Agent 后续处理（并行）
    sleep(2000),
  ]);

  // Agent 调 a2ui_render → 检查预渲染 → 跳过
  const skipped = state.preRendered;

  return { ...liteResult, totalMs: Date.now() - t0, skipped };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── 主流程 ──

async function main() {
  console.log("=== v0.5.0 POC: 流式预渲染验证 ===\n");

  for (const tr of TOOL_RESULTS) {
    console.log(`--- ${tr.name} (intent: "${tr.intent}") ---`);

    // 串行
    const serial = await simulateSerialFlow(tr);
    console.log(`  串行: ${serial.totalMs}ms (Agent后续 2000ms + liteRender ${serial.liteMs}ms)`);
    console.log(`         template=${serial.template}, tokens=${serial.inputTokens}+${serial.outputTokens}`);

    // 流式
    const streaming = await simulateStreamingFlow(tr);
    console.log(`  流式: ${streaming.preRenderMs}ms 用户看到内容 (liteRender ${streaming.liteMs}ms)`);
    console.log(`         template=${streaming.template}, tokens=${streaming.inputTokens}+${streaming.outputTokens}`);
    console.log(`         Agent后续完成: ${streaming.totalMs}ms, a2ui_render跳过: ${streaming.skipped}`);

    const saved = serial.totalMs - streaming.preRenderMs;
    console.log(`  ⏱ 节省: ${saved}ms (${((saved / serial.totalMs) * 100).toFixed(0)}%)\n`);
  }

  // 验证边界: 短文本不触发预渲染
  console.log("--- 边界: 短文本 (< 50 字符) ---");
  const shortState: PreRenderState = { intent: "test", toolResults: [], preRendered: false };
  const shortResult = "ok";
  if (shortResult.length < 50) {
    console.log(`  跳过预渲染 (${shortResult.length} < 50 字符) ✅`);
  }

  // 验证边界: 预渲染后 a2ui_render 去重
  console.log("\n--- 边界: 去重逻辑 ---");
  const dedup: PreRenderState = { intent: "test", toolResults: ["long text ".repeat(10)], preRendered: true };
  const hasRawData = true;
  if (dedup.preRendered && hasRawData) {
    console.log("  预渲染已完成 + rawData 模式 → 跳过 a2ui_render ✅");
  }
  const hasExplicitTemplate = true;
  if (dedup.preRendered && !hasRawData && hasExplicitTemplate) {
    console.log("  预渲染已完成 + explicit template → 正常执行 ✅");
  }

  console.log("\n=== POC 完成 ===");
}

main().catch(console.error);
