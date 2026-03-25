# Changelog

## v0.4.9 — 2026-03-25

流式渲染 + AgentOS 风格首页 + UI 全面优化。

### 新增

- **骨架屏** — 用户操作后 ~50ms 内显示骨架占位 UI，不再干等 Agent 响应（10s+）
- **AgentOS 首页** — 8 个系统应用图标网格（天气/监控/搜索/定时/Agent/文件/备忘/设置）+ 最近活动列表
- **home_screen 模板** — 首页模板化，支持不同 Agent 配置不同桌面应用
- **Token 用量显示** — sidebar 展示当轮 / 累计 token 使用量（input/output）
- **JSONL Copy 按钮** — sidebar JSONL 面板一键复制，方便调试

### 变更

- **surface 宽度** — 640px → 960px，更好利用 main 区域
- **slot-actions 合并** — 文字输入和操作按钮合并为一行，节省垂直空间
- **移动端适配** — 768px 断点响应式布局（sidebar 底部化、app grid 自适应）

### 修复

- **broadcast 覆盖 bug** — 扩展消息（tokenUsage/toast/frameState）不再覆盖主渲染内容
- 清理旧的 quick-action 全局 click handler 死代码

---

## v0.4.0 — 2026-03-25

模板驱动 UI 生成：LLM 不再需要输出 A2UI JSON，只需选模板 + 填数据。

### 新增

- **4 个新模板** — `data_table`（通用表格）、`status_page`（操作结果反馈）、`detail`（键值对详情）、`multi_card`（多卡片网格），内置模板总数 8 → 12
- **组合模板** — `templates` 数组参数，多个模板拼接到同一页面，覆盖复杂场景
- **`renderMulti()`** — engine.ts 新增组合渲染函数，自动处理 id 前缀避免冲突

### 变更

- **tool description 重写** — 从"教 LLM 写 A2UI components"改为"教 LLM 选模板"，input tokens 从 ~400 降至 ~200
- **parameters schema** — 新增 `templates` 数组字段

### 设计依据

token-benchmark 测试结果（Haiku 模型）：

| 场景 | A2UI 直出 | 模板+数据 | 节省 |
|------|----------|----------|------|
| 简单确认框 | 188 | 95 | 49% |
| 数据表格 | 280 | 180 | 36% |
| 复杂仪表盘 | 626 | 326 | 48% |

---

## v0.3.20 — 2026-03-24

RAG 意图匹配持续优化 + 前端渲染改进。

### 变更

- **RAG matcher** — 优化匹配逻辑，`matcher.ts` / `store.ts` 迭代完善
- **前端** — `client.ts` / `styles.ts` 持续打磨渲染效果，包大小从 61KB 增至 71KB

---

## v0.3.0 — 2026-03-24

架构升级：从模板渲染工具升级为有状态的 AgentOS UI 框架。

### 新增

- **任务状态机** (`src/core/state-machine.ts`) — idle → working → review → done / error 五态流转，声明式状态转换规则
- **四槽位框架管理器** (`src/core/frame-manager.ts`) — Header / Canvas / Actions / Context 四个独立 Surface 槽位，各状态有默认布局配置
- **框架控制协议** (`src/core/messages.ts`) — `frameStateMsg` / `slotVisibilityMsg` / `toastMsg` 等扩展消息，在标准 A2UI JSONL 之外传递框架控制指令
- **RAG 向量搜索** (`src/rag/`) — 缓存历史渲染结果，相似意图直接复用
  - `embedder.ts` — Bedrock Titan Embed v2 文本向量化
  - `store.ts` — S3 向量存储，启动时加载到内存，变更异步写回
  - `matcher.ts` — 串联 embedder + store，提供 match / learn 接口
- **DSL 设计文档** (`docs/dsl-to-a2ui-design.md`) — DSL → A2UI 预编译转换层设计稿，目标将 LLM 输出从 500-2000 tokens 降至 50-150 tokens

### 变更

- 测试用例从 27 增至 54，新增 VectorStore、Preview Server 集成测试
- 内置模板 7 个不变

---

## v0.2.14 — 2026-03-24

修复 action 无法触发 Agent 的根本问题。

### 修复

- **挂载 Gateway HTTP** — Preview Server 路由优先通过 `api.registerHttpRoute("/clawui", ...)` 挂到 Gateway HTTP server，请求在 Gateway request 上下文中执行，`subagent.run` 可正常调用
- 无 `registerHttpRoute` 时 fallback 到独立 HTTP server（开发模式）

---

## v0.2.12 — 2026-03-24

修复 idle 首屏交互问题。

### 修复

- **用户输入丢失** — submit action 的 `context.text` 未传入 Agent prompt，用户在 idle 首屏输入的文字被丢弃，Agent 只收到空的"确认提交"
- **按钮无反馈** — `postAction` 无任何 UI 反馈，用户以为没生效会连续点击；现在点击后立即显示 toast，fetch 失败也会提示
- **防重复点击** — 加入 `actionPending` 锁，防止连续触发

---

## v0.2.11 — 2026-03-24

Bug fixes：修复模板降级和数据绑定问题。

### 修复

- **form 模板 fallback** — TextField label 为 undefined，现在正确回退到 `field.name`
- **confirmation 模板 fallback** — Button 降级输出 child ID 而非按钮文字，现在正确解析 child 组件文本；未传 confirmLabel/cancelLabel 时默认 "Confirm"/"Cancel"
- **search_results snippet 丢失** — 展开器未读取 `item.snippet` 字段，Card 内容为空
- **markdown.ts 重构** — `toMarkdown` 构建组件索引，Button/Card 降级时查找 child 组件的实际文字

### 新增

- **test/server.test.ts** — Preview Server 集成测试（17 个用例），覆盖全部 HTTP 端点 + SSE + Demo 状态流转

---

## v0.2.3 — 2026-03-24

AgentOS 完整体验界面。

### 新增

- **Idle 首屏** — 问候语 + 输入框 + 4 个快捷操作入口，无推送时自动显示
- **五态界面切换** — idle/working/review/done/error 各状态有对应的 UI 布局
- **前端模块化** — `src/ui/styles.ts`（CSS）+ `src/ui/client.ts`（JS）拆分，makePage 精简为壳
- **Context 面板** — review 态自动展开右侧上下文面板
- **Quick Actions** — 点击快捷入口直接发送 action 到 Agent

### 变更

- Preview Server 从开发调试工具升级为 AgentOS 体验界面
- Header 槽位显示 Agent 状态指示器（无推送时按 frameState 自动渲染）
- Actions 槽位无内容时自动隐藏

---

## v0.2.0 — 2026-03-24

框架系统 + 状态机 + 扩展消息协议。

---

## v0.1.2 — 2026-03-22

A2UI v0.8 兼容 + Preview Server。

### 新增

- `src/server.ts` — 独立 HTTP Preview Server（默认端口 18000）
  - `GET /` — 浏览器渲染页面，SSE 实时更新
  - `POST /render` — 传 `{ template, data }` 生成 JSONL 并渲染
  - `POST /push` — 直接推送原始 JSONL
  - 插件启动时自动启动，也可 `npx tsx src/server.ts` 独立运行
- `pushToPreview()` — Agent 调用 `a2ui_render` 时自动推送到浏览器预览
- `configSchema.previewPort` — 可配置 Preview Server 端口

### 变更

- **`src/utils/jsonl.ts` — 重写为 A2UI v0.8 格式**
  - `createSurface` → `surfaceUpdate` + `beginRendering`
  - `updateComponents` → `surfaceUpdate`（组件格式改为 `{ TypeName: { ...props } }`）
  - `updateDataModel` → `dataModelUpdate`（增加 `op: "replace"`）
  - 修复：之前生成 v0.9 JSONL，OpenClaw 会拒绝（"currently supports v0.8 only"）
- `index.ts` — register 中启动 Preview Server，tool execute 中自动推送预览

---

## v0.5.0 — 2026-03-22

CLI 命令注册。

### 新增

- `src/cli.ts` — 3 个 CLI 命令通过 `api.registerCli` 注册：
  - `openclaw clawui list` — 列出所有模板及描述
  - `openclaw clawui preview <template> --data <json>` — 预览生成的 JSONL
  - `openclaw clawui push <template> --data <json> --node <node>` — 推送到 canvas 节点
- `index.ts` — 集成 registerCli 调用

---

## v0.3.0 — 2026-03-22

完整模板库 + 自定义模板加载。

### 新增

**5 个内置模板**
- `confirmation` — 确认对话框（标题 + 消息 + 确认/取消按钮），默认 cancel → surface.close
- `booking_form` — 预订表单（Restaurant/Date/Time/Guests 字段 + 确认/取消）
- `search_results` — 搜索结果列表，根据 `data.results` 动态生成 Card 组件
- `dashboard` — 数据仪表盘，根据 `data.metrics` 动态生成指标卡片（Row 布局）
- `settings` — 设置面板，根据 `data.settings` 动态生成 Toggle/TextField，默认 save → agent.prompt

**模板引擎重构**
- 通用 `expandArray` 机制替代原来的 form 专用展开逻辑
- 所有动态模板（form/search_results/dashboard/settings）统一使用 expander 注册表

**自定义模板加载**
- `registry.loadFromDir(dir)` — 从指定目录读取 `.json` 文件并注册为模板
- 插件启动时根据 `config.customTemplatesDir` 自动加载
- 支持 `~` 路径展开

### 变更

- `index.ts` — register 改为 async，支持自定义模板目录加载
- 内置模板总数：2 → 7

---



首个可用版本。实现插件骨架、核心 Agent Tool、模板系统，并提前完成了 action router 和 markdown 降级。

### 新增

**插件框架**
- `openclaw.plugin.json` — 插件 manifest（configSchema + uiHints）
- `index.ts` — 插件入口，注册 `a2ui_render` tool、action hook、Gateway RPC

**a2ui_render Agent Tool** (`src/tool.ts`)
- Agent 传入 `template` + `data` 或自定义 `components`，自动生成 A2UI v0.9 JSONL
- 支持 `actions` 参数注册 action 映射
- 支持 `surfaceId` 指定目标 Surface
- 自动生成 fallback Markdown

**模板系统** (`src/templates/`)
- `registry.ts` — 模板注册表，支持 register/get/list
- `engine.ts` — 模板引擎：查找模板 → 数据填充 → 输出组件列表
- `builtin/text_display.json` — 纯文本展示模板
- `builtin/form.json` — 动态表单模板（根据 `data.fields` 自动生成 TextField 组件）

**数据绑定** (`src/utils/data-binding.ts`)
- `{{var}}` 静态替换，支持嵌套路径 `{{user.name}}`
- 递归处理对象和数组

**JSONL 生成** (`src/utils/jsonl.ts`)
- 生成 A2UI v0.9 标准 JSONL（createSurface + updateComponents + updateDataModel）

**Action Router** (`src/actions/`) — 原计划 v0.2，提前实现
- `router.ts` — 声明式 `argMapping` + `{{context.*}}` 变量替换，按 surfaceId 隔离
- `builtins.ts` — 内置 action：`surface.close`、`surface.navigate`、`agent.prompt`

**Markdown 降级** (`src/fallback/markdown.ts`) — 原计划 v0.4，基础版提前实现
- 覆盖所有 A2UI 组件类型：Text/Button/TextField/DateTimeInput/Card/Image/Toggle/Select/Divider/Column/Row

**测试** (`test/`)
- 27 个测试用例，覆盖全部核心模块
- 使用 Node 内置 test runner + tsx，零额外测试框架依赖
- `npm test` 一键运行

### 项目结构

```
clawUI/
├── openclaw.plugin.json
├── index.ts
├── src/
│   ├── tool.ts
│   ├── templates/
│   │   ├── engine.ts
│   │   ├── registry.ts
│   │   └── builtin/
│   │       ├── text_display.json
│   │       └── form.json
│   ├── actions/
│   │   ├── router.ts
│   │   └── builtins.ts
│   ├── fallback/
│   │   └── markdown.ts
│   └── utils/
│       ├── data-binding.ts
│       └── jsonl.ts
├── test/
│   ├── data-binding.test.ts
│   ├── jsonl.test.ts
│   ├── engine.test.ts
│   ├── router.test.ts
│   └── fallback.test.ts
└── renderer/  (未改动，独立渲染器)
```

### 下一步

- v0.3: 补全模板库（booking_form / confirmation / search_results / dashboard / settings）+ 自定义模板加载
- v0.5: CLI 命令（`openclaw clawui list` / `preview` / `push`）
