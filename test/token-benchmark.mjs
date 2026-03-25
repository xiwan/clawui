/**
 * Token 消耗对比测试
 * 三种方式：A2UI 直出 / DSL 中间层 / 模板+数据槽
 */
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: "us-east-1" });
const MODEL = "us.anthropic.claude-3-5-haiku-20241022-v1:0";

async function call(system, userMsg) {
  const r = await client.send(new ConverseCommand({
    modelId: MODEL,
    system: [{ text: system }],
    messages: [{ role: "user", content: [{ text: userMsg }] }],
    inferenceConfig: { maxTokens: 4096 }
  }));
  const text = r.output.message.content[0].text;
  return { text, usage: r.usage };
}

// ============ 测试场景 ============
const SCENARIOS = [
  {
    name: "简单确认框",
    user: "让用户确认是否部署 v1.2.3 到生产环境"
  },
  {
    name: "数据表格",
    user: "展示3个服务器的状态：web-01 运行中 CPU 45%，web-02 运行中 CPU 72%，db-01 维护中 CPU 12%"
  },
  {
    name: "复杂仪表盘",
    user: "展示销售仪表盘：本月销售额 ¥195,000（+8.5%），订单数 892，客户数 12,345。最近3个月趋势：1月 12万，2月 15万，3月 19.5万。Top 3 销售：张三 ¥89,000，李四 ¥76,000，王五 ¥68,000"
  }
];

// ============ 方式 1: 直接输出 A2UI JSON ============
const SYSTEM_A2UI = `你是 UI 生成器。根据用户需求，直接输出 A2UI v0.8 JSONL。

格式要求：
- 每行一个 JSON 对象
- surfaceUpdate: { surfaceId, components: [{ id, component: { TypeName: { ...props } } }] }
- beginRendering: { surfaceId, root: "root-id" }
- 组件类型: Text, Button, TextField, Card, Row, Column, Divider, Toggle, Select, DateTimeInput, Image

只输出 JSONL，不要其他文字。`;

// ============ 方式 2: 输出 DSL ============
const SYSTEM_DSL = `你是 UI 配置生成器。根据用户需求，输出 JSON 格式的 UI DSL。

只输出 JSON，不要其他内容。结构：
{"layout":"single|split|grid-2|grid-3","title":"可选","widgets":[...],"actions":[...]}

可用组件：
- card: {"type":"card","props":{"title":"","content":"","icon":""}}
- form: {"type":"form","props":{"id":"","fields":[{"name":"","label":"","type":"text|select|date|number"}]}}
- table: {"type":"table","props":{"columns":[{"key":"","label":""}],"rows":[...]}}
- list: {"type":"list","props":{"items":[{"id":"","title":"","subtitle":""}]}}
- text: {"type":"text","props":{"content":"","variant":"h1|h2|body|caption"}}
- status: {"type":"status","props":{"status":"success|warning|error|info","title":"","message":""}}

只输出 JSON。`;

// ============ 方式 3: 模板+数据槽 ============
const SYSTEM_TEMPLATE = `你是 UI 模板选择器。根据用户需求，选择模板并填充数据。

只输出 JSON，不要其他内容。格式：
{"template":"模板名","data":{...}}

可用模板：
- confirmation: data: { title, message, confirmLabel?, cancelLabel? }
- form: data: { title?, fields: [{ name, label, type }], submitLabel? }
- data_table: data: { title?, columns: [{ key, label }], rows: [{ key: value }] }
- dashboard: data: { title?, metrics: [{ label, value, trend? }] }
- status: data: { status: "success|error|info", title, message? }
- search_results: data: { query?, results: [{ title, snippet }] }
- list: data: { title?, items: [{ title, subtitle? }] }

如果一个模板不够，可以输出数组：[{template, data}, ...]

只输出 JSON。`;

// ============ 执行测试 ============
console.log("=".repeat(70));
console.log("Token 消耗对比测试 — 模型:", MODEL);
console.log("=".repeat(70));

const results = [];

for (const scenario of SCENARIOS) {
  console.log(`\n${"─".repeat(70)}`);
  console.log(`场景: ${scenario.name}`);
  console.log(`用户: ${scenario.user}`);
  console.log(`${"─".repeat(70)}`);

  const methods = [
    { name: "A2UI 直出", system: SYSTEM_A2UI },
    { name: "DSL 中间层", system: SYSTEM_DSL },
    { name: "模板+数据槽", system: SYSTEM_TEMPLATE },
  ];

  const row = { scenario: scenario.name };

  for (const method of methods) {
    try {
      const { text, usage } = await call(method.system, scenario.user);
      row[method.name] = { input: usage.inputTokens, output: usage.outputTokens, total: usage.totalTokens };
      console.log(`\n[${method.name}] input=${usage.inputTokens} output=${usage.outputTokens} total=${usage.totalTokens}`);
      console.log(text.slice(0, 200) + (text.length > 200 ? "..." : ""));
    } catch (e) {
      console.error(`[${method.name}] ERROR:`, e.message);
      row[method.name] = { error: e.message };
    }
  }

  results.push(row);
}

// ============ 汇总 ============
console.log(`\n${"=".repeat(70)}`);
console.log("汇总（output tokens = LLM 实际生成量，越少越好）");
console.log("=".repeat(70));
console.log("\n| 场景 | A2UI 直出 | DSL 中间层 | 模板+数据槽 | DSL 节省 | 模板节省 |");
console.log("|------|----------|-----------|------------|---------|---------|");
for (const r of results) {
  const a = r["A2UI 直出"]?.output ?? "?";
  const d = r["DSL 中间层"]?.output ?? "?";
  const t = r["模板+数据槽"]?.output ?? "?";
  const dSave = typeof a === "number" && typeof d === "number" ? `${Math.round((1 - d / a) * 100)}%` : "?";
  const tSave = typeof a === "number" && typeof t === "number" ? `${Math.round((1 - t / a) * 100)}%` : "?";
  console.log(`| ${r.scenario} | ${a} | ${d} | ${t} | ${dSave} | ${tSave} |`);
}
