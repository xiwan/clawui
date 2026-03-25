# ClawUI 设计文档

## 定位

ClawUI 是一个 OpenClaw 插件，为 AI Agent 提供高层 A2UI 界面生成能力。

OpenClaw 已有底层 A2UI 管道（canvas `a2ui_push` / `a2ui_reset`），但 Agent 需要手写 JSONL。ClawUI 在此之上提供：

- 意图驱动的 UI 生成（Agent 描述意图，插件生成 A2UI）
- 用户 action 自动路由到 OpenClaw 工具
- 预制 Surface 模板
- 无 canvas 场景的 Markdown 降级

## 架构

```
                    OpenClaw Gateway (in-process)
                    ┌─────────────────────────────────────┐
                    │                                     │
  Agent ──tool──►   │  ClawUI Plugin                      │
                    │  ├── a2ui_render tool                │
                    │  │   (意图 → A2UI JSONL)             │
                    │  ├── template engine                 │
                    │  │   (预制模板 + 数据填充)            │
                    │  ├── action router                   │
                    │  │   (用户操作 → OpenClaw 工具)       │
                    │  └── fallback formatter              │
                    │      (A2UI → Markdown 降级)          │
                    │                                     │
                    │  ┌──────────────────────┐            │
                    │  │ 已有 canvas 管道      │            │
                    │  │ a2ui_push / a2ui_reset│            │
                    │  └──────────────────────┘            │
                    └─────────────────────────────────────┘
                              │                    ▲
                    A2UI JSONL │                    │ userAction
                              ▼                    │
                    ┌─────────────────────────────────────┐
                    │  Canvas Host (WebView / Browser)     │
                    │  A2UI Renderer (Lit)                 │
                    └─────────────────────────────────────┘
```

## 核心模块

### 1. Agent Tool: `a2ui_render`

注册一个高层 Agent 工具，Agent 不需要手写 JSONL。

```
Agent 调用:
  a2ui_render({
    template: "booking_form",
    data: { restaurant: "...", date: "...", guests: 2 },
    actions: { confirm: "message.send", cancel: "surface.close" }
  })

插件处理:
  1. 查找模板 "booking_form"
  2. 用 data 填充模板
  3. 将 actions 映射注册到 action router
  4. 生成 A2UI JSONL
  5. 调用已有 canvas a2ui_push 推送
```

参数设计：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| template | string | 否 | 预制模板名称 |
| components | object[] | 否 | 自定义组件列表（与 template 二选一） |
| data | object | 否 | 数据模型 |
| actions | object | 否 | action 名 → OpenClaw 工具映射 |
| surfaceId | string | 否 | Surface ID（默认 "main"） |
| fallback | string | 否 | 降级文本（无 canvas 时使用） |

### 2. Template Engine

预制模板库，覆盖常见场景：

| 模板 | 用途 | 组件 |
|------|------|------|
| `text_display` | 纯文本展示 | Text |
| `form` | 通用表单 | TextField + Button |
| `booking_form` | 预订表单 | DateTimeInput + TextField + Button |
| `search_results` | 搜索结果列表 | Column + Card + Text |
| `confirmation` | 确认对话框 | Text + Button × 2 |
| `dashboard` | 数据仪表盘 | Row + Card + Text |
| `settings` | 设置面板 | Column + Toggle + TextField |

模板格式（JSON）：

```json
{
  "id": "booking_form",
  "version": "v0.9",
  "description": "Restaurant booking form",
  "dataSchema": {
    "restaurant": "string",
    "date": "string",
    "time": "string",
    "guests": "number"
  },
  "components": [
    { "id": "root", "component": "Column", "children": ["header", "fields", "actions"] },
    { "id": "header", "component": "Text", "text": "{{title}}", "variant": "h1" },
    { "id": "fields", "component": "Column", "children": ["date-field", "guests-field"] },
    { "id": "date-field", "component": "DateTimeInput", "label": "Date", "value": { "path": "/date" }, "enableDate": true },
    { "id": "guests-field", "component": "TextField", "label": "Guests", "value": { "path": "/guests" } },
    { "id": "actions", "component": "Row", "children": ["confirm-btn", "cancel-btn"] },
    { "id": "confirm-btn", "component": "Button", "child": "confirm-label", "variant": "primary", "action": { "event": { "name": "confirm" } } },
    { "id": "confirm-label", "component": "Text", "text": "Confirm" },
    { "id": "cancel-btn", "component": "Button", "child": "cancel-label", "action": { "event": { "name": "cancel" } } },
    { "id": "cancel-label", "component": "Text", "text": "Cancel" }
  ]
}
```

### 3. Action Router

用户在 A2UI 界面上的操作通过 `OpenClaw.sendUserAction()` 回传。ClawUI 拦截这些 action，根据注册的映射调用对应的 OpenClaw 工具。

映射规则：

```json
{
  "confirm": {
    "tool": "message",
    "action": "send",
    "argMapping": {
      "channel": "{{context.channel}}",
      "target": "{{context.target}}",
      "message": "Booking confirmed: {{context.details}}"
    }
  },
  "cancel": {
    "builtin": "surface.close"
  },
  "search": {
    "tool": "web_search",
    "argMapping": {
      "query": "{{context.query}}"
    }
  },
  "set_reminder": {
    "tool": "cron",
    "action": "create",
    "argMapping": {
      "expression": "{{context.cron}}",
      "command": "{{context.command}}"
    }
  }
}
```

内置 action：

| Action | 行为 |
|--------|------|
| `surface.close` | 调用 canvas a2ui_reset 关闭界面 |
| `surface.navigate` | 调用 canvas navigate 跳转 |
| `agent.prompt` | 将 context 作为新 prompt 发给 Agent |

### 4. Fallback Formatter

当目标设备没有 canvas 能力时（Discord、飞书、Telegram 等），将 A2UI 组件降级为 Markdown 文本。

降级规则：

| A2UI 组件 | Markdown 输出 |
|-----------|---------------|
| Text (h1) | `# title` |
| Text (h2) | `## title` |
| Text (body) | 正文 |
| TextField | `📝 label: ___` |
| Button | `[label]` |
| Card | `> 📋 title` |
| DateTimeInput | `📅 label: value` |
| Column/Row | 子组件换行拼接 |
| Image | `🖼️ alt` |

## 插件接口

### openclaw.plugin.json

```json
{
  "id": "clawui",
  "name": "ClawUI",
  "description": "High-level A2UI interface generation for AI agents",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "defaultSurfaceId": {
        "type": "string",
        "default": "main"
      },
      "enableFallback": {
        "type": "boolean",
        "default": true
      },
      "customTemplatesDir": {
        "type": "string"
      }
    }
  },
  "uiHints": {
    "defaultSurfaceId": { "label": "Default Surface ID", "placeholder": "main" },
    "enableFallback": { "label": "Enable Markdown Fallback" },
    "customTemplatesDir": { "label": "Custom Templates Directory", "placeholder": "~/.openclaw/clawui-templates" }
  }
}
```

### 插件入口 (index.ts)

```typescript
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

const plugin = {
  id: "clawui",
  name: "ClawUI",
  description: "High-level A2UI interface generation",
  configSchema: { /* ... */ },

  register(api: OpenClawPluginApi) {
    // 1. 注册 Agent Tool
    api.registerTool({
      name: "a2ui_render",
      description: "Render an interactive A2UI surface from a template or component list",
      parameters: { /* TypeBox schema */ },
      execute: async (id, params) => { /* ... */ },
    });

    // 2. 注册 Action Handler hook
    api.on("canvas.a2ui.action", (event, ctx) => {
      // 根据 action mapping 路由到对应工具
    });

    // 3. 注册 CLI 命令
    api.registerCli(({ program }) => {
      program.command("clawui")
        .description("ClawUI template management")
        .command("list").action(() => { /* 列出模板 */ });
      program.command("clawui")
        .command("preview <template>").action((tpl) => { /* 预览模板 */ });
    }, { commands: ["clawui"] });

    // 4. 注册 Gateway RPC
    api.registerGatewayMethod("clawui.templates", ({ respond }) => {
      respond(true, { templates: listTemplates() });
    });
    api.registerGatewayMethod("clawui.render", ({ respond, params }) => {
      const jsonl = renderTemplate(params);
      respond(true, { jsonl });
    });
  },
};

export default plugin;
```

## 数据流

### 正常流程（有 canvas）

```
1. Agent 调用 a2ui_render({ template: "booking_form", data: {...}, actions: {...} })
2. ClawUI 查找模板，填充数据，生成 A2UI v0.9 JSONL
3. ClawUI 注册 action 映射到内存
4. ClawUI 调用 canvas a2ui_push 推送 JSONL
5. Canvas Host 渲染 A2UI 界面
6. 用户操作 → userAction 回传
7. ClawUI action router 拦截，查找映射
8. 调用对应 OpenClaw 工具（message/cron/web_search 等）
9. 工具结果可选择更新 Surface 或关闭
```

### 降级流程（无 canvas）

```
1. Agent 调用 a2ui_render({ template: "booking_form", data: {...}, fallback: "auto" })
2. ClawUI 检测目标无 canvas 能力
3. ClawUI 将组件降级为 Markdown
4. 通过 message tool 发送文字卡片到 Discord/飞书/Telegram
```

## 文件结构

```
clawUI/
├── openclaw.plugin.json          # 插件 manifest
├── index.ts                      # 插件入口
├── package.json
├── tsconfig.json
├── src/
│   ├── tool.ts                   # a2ui_render Agent Tool 实现
│   ├── templates/
│   │   ├── engine.ts             # 模板引擎（查找、填充、生成 JSONL）
│   │   ├── registry.ts           # 模板注册表
│   │   └── builtin/              # 内置模板 JSON 文件
│   │       ├── text_display.json
│   │       ├── form.json
│   │       ├── booking_form.json
│   │       ├── search_results.json
│   │       ├── confirmation.json
│   │       └── dashboard.json
│   ├── actions/
│   │   ├── router.ts             # Action → 工具调用路由
│   │   └── builtins.ts           # 内置 action（surface.close 等）
│   ├── fallback/
│   │   └── markdown.ts           # A2UI → Markdown 降级
│   └── utils/
│       ├── jsonl.ts              # JSONL 生成工具
│       └── data-binding.ts       # 模板变量替换 {{path}}
├── test/
│   ├── tool.test.ts
│   ├── engine.test.ts
│   ├── router.test.ts
│   └── fallback.test.ts
└── docs/
    ├── DESIGN.md                 # 本文档
    ├── TEMPLATES.md              # 模板开发指南
    └── INTEGRATION.md            # OpenClaw 集成指南
```

## 依赖

- `openclaw/plugin-sdk/core` — 插件 API
- `@sinclair/typebox` — Tool 参数 schema（OpenClaw 标准）
- OpenClaw 已有的 canvas 管道 — 不重复实现

## 版本计划

| 版本 | 内容 | 状态 |
|------|------|------|
| v0.1 | 插件骨架 + a2ui_render tool + text_display/form 模板 | ✅ 完成 |
| v0.2 | Action router + 内置 action + 工具映射 | ✅ 已提前实现（随 v0.1 一起） |
| v0.3 | 完整模板库 + 自定义模板加载 | ✅ 完成 |
| v0.4 | Markdown 降级 + 多通道适配 | ✅ 基础降级已实现（随 v0.1 一起） |
| v0.5 | CLI 命令 + 模板预览 | ✅ 完成 |
