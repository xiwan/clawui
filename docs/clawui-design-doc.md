# ClawUI 技术设计文档

> **版本**: v0.1 (Draft)
> **日期**: 2026-03-23
> **作者**: 佳佳 (产品设计) / 待定 (开发)
> **状态**: 设计阶段

---

## 1. 产品概述

### 1.1 产品定位

**ClawUI** 是 OpenClaw 生态的官方 UI 层，作为 OpenClaw 的前端插件存在。它基于 Google A2UI 协议（v0.8），为个人用户提供一个 **Agent 驱动的自适应界面**。

**一句话定义**：让 AI Agent 的输出不再是纯文字，而是结构化、可交互的原生界面。

### 1.2 设计原则

| 原则 | 说明 |
|-----|------|
| **框架固定，内容动态** | 用户熟悉的布局结构 + Agent 灵活填充的内容 |
| **渐进式复杂度** | 简单任务简单界面，复杂任务展开更多区域 |
| **状态可感知** | Agent 的思考、等待、执行状态都有 UI 表达 |
| **反馈闭环** | UI 不只展示，还是 Agent 感知用户意图的传感器 |
| **安全优先** | 遵循 A2UI 声明式设计，Agent 只能使用白名单组件 |

### 1.3 目标用户

- **主要用户**: 个人用户（非技术背景）
- **使用场景**: 个人助理、日程管理、信息整理、任务执行
- **设备**: 桌面浏览器（优先）、平板、手机（自适应）

### 1.4 技术栈

| 层级 | 技术选型 |
|-----|---------|
| **Agent 框架** | OpenClaw (作为 Gateway) |
| **UI 协议** | A2UI v0.8 |
| **前端框架** | 待定 (推荐 React/Vue/Lit) |
| **传输层** | WebSocket (OpenClaw Gateway) |
| **部署形态** | OpenClaw 插件 / 独立 Web 应用 |

---

## 2. 框架系统设计

### 2.1 核心理念：Slot-based Layout

ClawUI 采用 **槽位式布局**：界面由固定的「框架槽位」组成，Agent 往槽位里填充内容。

这解决了两个矛盾：
- **Agent 需要灵活性**：根据任务动态生成 UI
- **用户需要一致性**：不想每次重新学习界面

### 2.2 四大框架槽位

```
┌─────────────────────────────────────────────────────────────┐
│  [Header Slot]                                              │
│  状态栏：任务标题、Agent 状态指示器、全局操作                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Canvas Slot]                                              │
│  主工作区：Agent 的主要输出区域                                │
│  - 表单、卡片、列表、图表等                                   │
│  - 最大自由度，Agent 的主战场                                 │
│                                                             │
├──────────────────────────────────┬──────────────────────────┤
│  [Actions Slot]                  │  [Context Slot]          │
│  操作栏：确认、取消、更多选项      │  上下文面板（可折叠）      │
│  固定位置，用户形成肌肉记忆        │  历史、相关信息、建议      │
└──────────────────────────────────┴──────────────────────────┘
```

### 2.3 槽位详细规格

#### 2.3.1 Header Slot

**位置**: 顶部固定
**高度**: 48-64px (自适应)
**职责**:
- 显示当前任务标题
- Agent 状态指示器（思考中/执行中/等待输入/完成）
- 全局操作（设置、历史、帮助）

**Agent 可填充内容**:
```typescript
interface HeaderContent {
  title: string;              // 任务标题
  subtitle?: string;          // 副标题/描述
  status: AgentStatus;        // 'thinking' | 'executing' | 'waiting' | 'done' | 'error'
  statusText?: string;        // 状态描述文字
  actions?: HeaderAction[];   // 右侧操作按钮
}
```

#### 2.3.2 Canvas Slot

**位置**: 中央主区域
**高度**: 弹性填充
**职责**:
- Agent 的主要输出区域
- 最高自由度，支持所有 A2UI 组件

**Agent 可填充内容**:
- 任意 A2UI 组件树
- 支持滚动
- 支持多个独立卡片或单一内容

#### 2.3.3 Actions Slot

**位置**: 底部固定
**高度**: 56-72px (自适应)
**职责**:
- 主要操作按钮（确认/取消/提交）
- 次要操作（更多选项）

**Agent 可填充内容**:
```typescript
interface ActionsContent {
  primary?: ActionButton;     // 主按钮（右侧突出）
  secondary?: ActionButton;   // 次按钮（左侧）
  tertiary?: ActionButton[];  // 更多操作（折叠菜单）
}

interface ActionButton {
  id: string;
  label: string;
  action: string;             // 点击后发送给 Agent 的 action 标识
  style?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}
```

#### 2.3.4 Context Slot

**位置**: 右侧或底部（响应式）
**宽度**: 280-360px (桌面) / 全宽折叠 (移动)
**职责**:
- 上下文信息（历史、相关内容）
- 默认折叠，按需展开

**Agent 可填充内容**:
```typescript
interface ContextContent {
  visible: boolean;           // 是否展开
  sections: ContextSection[];
}

interface ContextSection {
  title: string;
  items: ContextItem[];
}

interface ContextItem {
  id: string;
  label: string;
  preview?: string;
  action?: string;            // 点击后的动作
}
```

### 2.4 响应式布局规则

| 断点 | 布局 |
|-----|------|
| **Desktop** (≥1024px) | Header + Canvas + Actions + Context(侧边) |
| **Tablet** (768-1023px) | Header + Canvas + Actions, Context 浮层 |
| **Mobile** (<768px) | Header(精简) + Canvas + Actions(底部固定), Context 全屏抽屉 |

---

## 3. 状态机与生命周期

### 3.1 任务生命周期

```
                    ┌──────────────────┐
                    │                  │
                    ▼                  │
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Idle   │───▶│ Working │───▶│ Review  │───▶│  Done   │
│  空闲态  │    │  执行态  │    │  确认态  │    │  完成态  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │
     │              │              │              │
     ▼              ▼              ▼              ▼
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 输入框   │    │ 进度条   │    │ 结果展示 │    │ 成功反馈 │
│ 快捷入口 │    │ 状态文字 │    │ 操作按钮 │    │ 下一步   │
│ 历史    │    │ 取消按钮 │    │ 修改选项 │    │ 评价    │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
```

### 3.2 状态定义

```typescript
type TaskState = 'idle' | 'working' | 'review' | 'done' | 'error';

interface TaskContext {
  state: TaskState;
  taskId?: string;
  taskTitle?: string;
  progress?: number;          // 0-1
  error?: ErrorInfo;
}
```

### 3.3 状态转换触发

| 当前状态 | 触发条件 | 目标状态 |
|---------|---------|---------|
| idle | 用户发送消息 / 点击快捷入口 | working |
| working | Agent 完成任务，需要确认 | review |
| working | Agent 完成任务，无需确认 | done |
| working | Agent 遇到错误 | error |
| working | 用户点击取消 | idle |
| review | 用户确认 | done |
| review | 用户要求修改 | working |
| review | 用户取消 | idle |
| done | 超时自动 / 用户关闭 | idle |
| error | 用户重试 | working |
| error | 用户取消 | idle |

### 3.4 各状态的框架配置

```typescript
const stateFrameConfig: Record<TaskState, FrameConfig> = {
  idle: {
    header: { visible: true, compact: true },
    canvas: { content: 'input-prompt' },       // 输入框 + 快捷入口
    actions: { visible: false },
    context: { visible: false, content: 'history' }
  },
  working: {
    header: { visible: true, showStatus: true },
    canvas: { content: 'agent-output' },       // Agent 动态填充
    actions: { visible: true, buttons: ['cancel'] },
    context: { visible: false }
  },
  review: {
    header: { visible: true, showStatus: true },
    canvas: { content: 'agent-output' },
    actions: { visible: true, buttons: ['confirm', 'edit', 'cancel'] },
    context: { visible: true, content: 'related' }
  },
  done: {
    header: { visible: true, compact: true },
    canvas: { content: 'result-summary' },
    actions: { visible: true, buttons: ['new-task', 'feedback'] },
    context: { visible: false }
  },
  error: {
    header: { visible: true, showStatus: true },
    canvas: { content: 'error-detail' },
    actions: { visible: true, buttons: ['retry', 'cancel'] },
    context: { visible: false }
  }
};
```

---

## 4. A2UI 消息协议

### 4.1 消息流向

```
┌─────────────┐         A2UI JSONL          ┌─────────────┐
│             │ ─────────────────────────▶  │             │
│  OpenClaw   │                             │   ClawUI    │
│   Agent     │  ◀─────────────────────────  │  Renderer   │
│             │        userAction           │             │
└─────────────┘                             └─────────────┘
```

### 4.2 Agent → ClawUI (A2UI v0.8)

#### 4.2.1 Surface 更新

```jsonl
{"surfaceUpdate":{"surfaceId":"header","components":[
  {"id":"title","component":{"Text":{"text":"整理本周会议","usageHint":"h2"}}},
  {"id":"status","component":{"StatusIndicator":{"status":"working","text":"正在分析日历..."}}}
]}}
```

#### 4.2.2 开始渲染

```jsonl
{"beginRendering":{"surfaceId":"canvas","root":"root"}}
```

#### 4.2.3 数据模型更新

```jsonl
{"dataModelUpdate":{"surfaceId":"canvas","updates":[
  {"path":"progress","value":0.65},
  {"path":"statusText","value":"已处理 3/5 个会议"}
]}}
```

#### 4.2.4 删除 Surface

```jsonl
{"deleteSurface":{"surfaceId":"temp-notification"}}
```

### 4.3 ClawUI → Agent (userAction)

#### 4.3.1 按钮点击

```json
{
  "userAction": {
    "surfaceId": "actions",
    "componentId": "confirm-btn",
    "action": "confirm",
    "payload": {}
  }
}
```

#### 4.3.2 表单提交

```json
{
  "userAction": {
    "surfaceId": "canvas",
    "componentId": "booking-form",
    "action": "submit",
    "payload": {
      "date": "2026-03-25",
      "time": "19:00",
      "guests": 2
    }
  }
}
```

#### 4.3.3 选择/交互

```json
{
  "userAction": {
    "surfaceId": "canvas",
    "componentId": "meeting-list",
    "action": "select",
    "payload": {
      "selectedIds": ["meeting-1", "meeting-3"]
    }
  }
}
```

### 4.4 ClawUI 扩展消息

除了标准 A2UI 消息，ClawUI 定义以下扩展消息用于框架控制：

#### 4.4.1 框架状态切换

```jsonl
{"clawui":{"frameState":{"state":"review","transition":"slide-up"}}}
```

#### 4.4.2 槽位可见性

```jsonl
{"clawui":{"slotVisibility":{"context":true,"actions":true}}}
```

#### 4.4.3 Toast/通知

```jsonl
{"clawui":{"toast":{"message":"已保存到日历","type":"success","duration":3000}}}
```

---

## 5. 组件白名单

### 5.1 基础组件

| 组件 | 用途 | A2UI Type |
|-----|------|-----------|
| Text | 文字显示 | `Text` |
| Button | 按钮 | `Button` |
| TextField | 文本输入 | `TextField` |
| TextArea | 多行文本 | `TextArea` |
| Select | 下拉选择 | `Select` |
| Checkbox | 复选框 | `Checkbox` |
| Radio | 单选框 | `Radio` |
| Switch | 开关 | `Switch` |
| Slider | 滑块 | `Slider` |
| DatePicker | 日期选择 | `DatePicker` |
| TimePicker | 时间选择 | `TimePicker` |

### 5.2 布局组件

| 组件 | 用途 | A2UI Type |
|-----|------|-----------|
| Column | 垂直布局 | `Column` |
| Row | 水平布局 | `Row` |
| Card | 卡片容器 | `Card` |
| Divider | 分割线 | `Divider` |
| Spacer | 间距 | `Spacer` |
| ScrollView | 滚动容器 | `ScrollView` |

### 5.3 展示组件

| 组件 | 用途 | A2UI Type |
|-----|------|-----------|
| Image | 图片 | `Image` |
| Icon | 图标 | `Icon` |
| Badge | 徽章 | `Badge` |
| Avatar | 头像 | `Avatar` |
| ProgressBar | 进度条 | `ProgressBar` |
| Spinner | 加载动画 | `Spinner` |
| Tag | 标签 | `Tag` |

### 5.4 复合组件

| 组件 | 用途 | A2UI Type |
|-----|------|-----------|
| List | 列表 | `List` |
| ListItem | 列表项 | `ListItem` |
| Table | 表格 | `Table` |
| Form | 表单 | `Form` |
| FormField | 表单字段 | `FormField` |
| Accordion | 折叠面板 | `Accordion` |
| Tabs | 标签页 | `Tabs` |

### 5.5 ClawUI 专属组件

| 组件 | 用途 | 说明 |
|-----|------|------|
| StatusIndicator | Agent 状态 | 显示 thinking/working/done 等状态 |
| InputPrompt | 输入提示 | 空闲态的输入框 + 建议 |
| QuickActions | 快捷操作 | 预设的常用任务入口 |
| HistoryItem | 历史记录 | Context 中的历史任务项 |
| ErrorPanel | 错误面板 | 错误详情 + 重试选项 |
| SuccessPanel | 成功面板 | 完成确认 + 后续建议 |

---

## 6. 多 Agent 支持

### 6.1 场景说明

OpenClaw 支持单 Gateway 运行多个 Agent（通过 session 区分），ClawUI 需要支持：

1. **单 Agent 单任务**：最常见场景
2. **单 Agent 多任务**：Agent 并行处理多个任务
3. **多 Agent 协作**：多个 Agent 各自负责一部分 UI

### 6.2 Surface 命名空间

```
surfaceId = "{agentId}:{slotId}:{instanceId}"

示例：
- "main:header:0"        → 主 Agent 的 Header
- "main:canvas:0"        → 主 Agent 的 Canvas
- "research:canvas:1"    → 调研 Agent 的第二个 Canvas 实例
```

### 6.3 多 Agent UI 合成规则

| 场景 | Header | Canvas | Actions | Context |
|-----|--------|--------|---------|---------|
| 单 Agent | Agent 独占 | Agent 独占 | Agent 独占 | Agent 独占 |
| 多 Agent 协作 | 主 Agent | 分区/标签页 | 主 Agent | 各 Agent 贡献 |

**Canvas 分区模式**：

```
┌─────────────────────────────────────┐
│  [Tab: 主任务]  [Tab: 调研]  [Tab: 写作] │
├─────────────────────────────────────┤
│                                     │
│  当前 Tab 对应 Agent 的 Canvas 内容    │
│                                     │
└─────────────────────────────────────┘
```

### 6.4 Agent 间 UI 冲突处理

```typescript
interface SurfacePriority {
  agentId: string;
  priority: number;        // 数字越大优先级越高
  exclusive?: boolean;     // 是否独占（其他 Agent 不能修改）
}

// 冲突规则：
// 1. exclusive=true 的 Agent 独占该槽位
// 2. 否则按 priority 排序，高优先级覆盖低优先级
// 3. 同优先级按时间戳，后来者覆盖
```

---

## 7. 与 OpenClaw 集成

### 7.1 作为 OpenClaw Skill

ClawUI 作为 OpenClaw 的一个 Skill 存在：

```
skills/
  clawui/
    SKILL.md
    scripts/
      render.js       # A2UI 渲染逻辑
      actions.js      # userAction 处理
    components/
      ...             # 组件定义
```

### 7.2 Gateway 配置

```yaml
# clawd.yaml
gateway:
  port: 18789

canvasHost:
  enabled: true
  port: 18793
  # ClawUI 作为默认 Canvas 应用
  defaultApp: "clawui"

clawui:
  enabled: true
  theme: "light"          # light | dark | auto
  layout: "default"       # default | compact | minimal
```

### 7.3 消息路由

```
用户输入
    │
    ▼
┌─────────────┐
│  OpenClaw   │
│   Gateway   │
└──────┬──────┘
       │
       ▼
┌─────────────┐    A2UI     ┌─────────────┐
│   Agent     │ ──────────▶ │   ClawUI    │
│  (Claude)   │             │  (Browser)  │
└─────────────┘ ◀────────── └─────────────┘
                 userAction
```

---

## 8. 典型场景示例

### 8.1 场景：整理本周会议

**用户输入**: "帮我整理下这周的会议"

**阶段 1: Working**

```jsonl
// Header
{"surfaceUpdate":{"surfaceId":"header","components":[
  {"id":"title","component":{"Text":{"text":"整理本周会议","usageHint":"h2"}}},
  {"id":"status","component":{"StatusIndicator":{"status":"working","text":"正在读取日历..."}}}
]}}

// Canvas
{"surfaceUpdate":{"surfaceId":"canvas","components":[
  {"id":"root","component":{"Column":{"children":{"explicitList":["progress","status"]}}}},
  {"id":"progress","component":{"ProgressBar":{"value":0.3}}},
  {"id":"status","component":{"Text":{"text":"正在分析会议内容..."}}}
]}}
{"beginRendering":{"surfaceId":"canvas","root":"root"}}

// Actions
{"surfaceUpdate":{"surfaceId":"actions","components":[
  {"id":"cancel","component":{"Button":{"label":"取消","action":"cancel","style":"secondary"}}}
]}}
```

**阶段 2: Review**

```jsonl
// Header
{"dataModelUpdate":{"surfaceId":"header","updates":[
  {"path":"status","value":"waiting"},
  {"path":"statusText","value":"已整理完成，请确认"}
]}}

// Canvas - 展示结果
{"surfaceUpdate":{"surfaceId":"canvas","components":[
  {"id":"root","component":{"Column":{"children":{"explicitList":["summary","list"]}}}},
  {"id":"summary","component":{"Card":{"children":{"explicitList":["summary-text"]}}}},
  {"id":"summary-text","component":{"Text":{"text":"本周共 5 场会议，总计 8 小时"}}},
  {"id":"list","component":{"List":{"children":{"explicitList":["m1","m2","m3","m4","m5"]}}}}
  // ... 会议列表项
]}}

// Actions - 确认按钮
{"surfaceUpdate":{"surfaceId":"actions","components":[
  {"id":"confirm","component":{"Button":{"label":"确认","action":"confirm","style":"primary"}}},
  {"id":"edit","component":{"Button":{"label":"修改","action":"edit","style":"secondary"}}},
  {"id":"cancel","component":{"Button":{"label":"取消","action":"cancel","style":"text"}}}
]}}
```

### 8.2 场景：预订餐厅

**用户输入**: "帮我订个明天晚上的餐厅，两个人"

**Canvas 内容**:

```jsonl
{"surfaceUpdate":{"surfaceId":"canvas","components":[
  {"id":"root","component":{"Column":{"children":{"explicitList":["form"]}}}},
  {"id":"form","component":{"Form":{"children":{"explicitList":["date","time","guests","cuisine","submit"]}}}},
  {"id":"date","component":{"FormField":{"label":"日期","child":"date-picker"}}},
  {"id":"date-picker","component":{"DatePicker":{"value":"2026-03-24","min":"2026-03-24"}}},
  {"id":"time","component":{"FormField":{"label":"时间","child":"time-picker"}}},
  {"id":"time-picker","component":{"TimePicker":{"value":"19:00"}}},
  {"id":"guests","component":{"FormField":{"label":"人数","child":"guests-select"}}},
  {"id":"guests-select","component":{"Select":{"value":"2","options":[
    {"value":"1","label":"1人"},
    {"value":"2","label":"2人"},
    {"value":"3","label":"3人"},
    {"value":"4","label":"4人"},
    {"value":"5+","label":"5人以上"}
  ]}}},
  {"id":"cuisine","component":{"FormField":{"label":"菜系偏好（可选）","child":"cuisine-input"}}},
  {"id":"cuisine-input","component":{"TextField":{"placeholder":"如：日料、川菜、西餐..."}}},
  {"id":"submit","component":{"Button":{"label":"搜索餐厅","action":"search","style":"primary"}}}
]}}
```

---

## 9. 开发里程碑

### Phase 1: 基础框架 (2 周)

- [ ] 项目脚手架搭建
- [ ] 四槽位布局实现
- [ ] 响应式适配（Desktop/Tablet/Mobile）
- [ ] 状态机实现
- [ ] 基础组件库（Text, Button, TextField, Card, Column, Row）

### Phase 2: A2UI 集成 (2 周)

- [ ] A2UI v0.8 消息解析
- [ ] Surface 渲染引擎
- [ ] userAction 事件发送
- [ ] 与 OpenClaw Gateway WebSocket 连接
- [ ] 增量更新支持

### Phase 3: 完整组件库 (2 周)

- [ ] 全部基础组件
- [ ] 全部布局组件
- [ ] 全部展示组件
- [ ] ClawUI 专属组件
- [ ] 主题系统（Light/Dark）

### Phase 4: 多 Agent 支持 (1 周)

- [ ] Surface 命名空间
- [ ] 多 Agent UI 合成
- [ ] 冲突处理

### Phase 5: 打磨与发布 (1 周)

- [ ] 动画与过渡效果
- [ ] 性能优化
- [ ] 文档完善
- [ ] OpenClaw Skill 打包发布

---

## 10. 附录

### A. 参考资料

- [A2UI GitHub](https://github.com/google/A2UI)
- [A2UI 官网](https://a2ui.org)
- [A2UI v0.8 Spec](https://a2ui.org/specification/v0.8-a2ui/)
- [Google A2UI 发布博客](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/)
- [OpenClaw 文档](https://docs.clawd.bot)

### B. 术语表

| 术语 | 定义 |
|-----|------|
| Surface | A2UI 中的渲染单元，一个独立的 UI 区域 |
| Slot | ClawUI 的框架槽位（Header/Canvas/Actions/Context） |
| Component | A2UI 组件，如 Text, Button, Card |
| userAction | 用户交互事件，从 ClawUI 发送给 Agent |
| Frame State | ClawUI 的任务状态（idle/working/review/done/error） |

### C. 文件结构

```
clawui/
├── src/
│   ├── core/
│   │   ├── frame-manager.ts      # 框架管理器
│   │   ├── state-machine.ts      # 状态机
│   │   ├── surface-renderer.ts   # Surface 渲染
│   │   └── gateway-client.ts     # OpenClaw 连接
│   ├── slots/
│   │   ├── header/
│   │   ├── canvas/
│   │   ├── actions/
│   │   └── context/
│   ├── components/
│   │   ├── basic/
│   │   ├── layout/
│   │   ├── display/
│   │   └── clawui/
│   ├── themes/
│   │   ├── light.css
│   │   └── dark.css
│   └── index.ts
├── public/
├── package.json
└── README.md
```

---

## 11. RAG 意图缓存设计（v0.3）

### 11.1 背景与动机

ClawUI 的核心瓶颈在于 LLM 推理延迟。每次用户操作都需要 Agent 从头生成完整的 A2UI 组件 JSON（通常几千 token），加上 Agent 冷启动、工具调用等开销，一次交互耗时可达数十秒。

观察发现：大量用户请求的意图是重复的（如"查看天气"、"系统信息"），Agent 每次生成的界面结构也高度相似。因此引入 Embedding + RAG 缓存机制，对已见过的意图直接复用历史渲染结果，跳过 LLM。

### 11.2 架构

```
用户输入 "查看系统信息"
    │
    ▼
Embedding 模型 (Bedrock)
    │ → 1024 维向量
    ▼
S3 向量存储 (内存索引 + S3 持久化)
    │
    ├─ 余弦相似度 > 阈值 → 命中 → 直接推送缓存的渲染结果 (跳过 LLM)
    │
    └─ 未命中 → 走 Agent LLM → 渲染 → 自动学习入库
```

### 11.3 模块

| 模块 | 文件 | 职责 |
|------|------|------|
| Embedder | `src/rag/embedder.ts` | 封装 Bedrock embedding API 调用 |
| VectorStore | `src/rag/store.ts` | S3 JSON 存储，启动时加载到内存，余弦相似度暴力搜索 |
| IntentMatcher | `src/rag/matcher.ts` | 串联 embedder + store，提供 match/learn 接口 |

### 11.4 数据结构

每条向量记录：

```json
{
  "id": "uuid",
  "text": "查看当前系统信息，包括服务器状态、负载、内存等",
  "embedding": [0.12, -0.34, ...],   // 1024 维
  "renderResult": { ... },            // a2ui_render 的完整参数，命中时直接 executeRender
  "agentId": "main",
  "hitCount": 5,
  "createdAt": "2026-03-24T12:36:49Z"
}
```

### 11.5 Embedding 模型选型

我们在 Bedrock 上对 4 个 embedding 模型做了中文意图匹配的对比测试。

**测试方法**：存储文本 `"查看当前系统信息，包括服务器状态、负载、内存等"`，用 6 个查询（4 个相关、2 个不相关）计算余弦相似度。关键指标是**区分度**（相关最低分 − 不相关最高分），越大越好。

| 查询 | Nova MME | Titan v2 | Cohere v3 | Cohere v4 |
|------|----------|----------|-----------|-----------|
| ✓ 查看系统信息 | 0.70 | **0.80** | 0.73 | 0.56 |
| ✓ 系统信息 | 0.54 | 0.61 | **0.67** | 0.51 |
| ✓ 服务器状态 | 0.56 | 0.47 | **0.67** | 0.50 |
| ✓ 看看系统状态 | 0.58 | 0.72 | **0.73** | 0.49 |
| ✗ 查看天气 | 0.53 | 0.28 | 0.56 | 0.33 |
| ✗ 帮我订个餐厅 | 0.37 | 0.15 | 0.44 | 0.10 |
| **区分度** | +0.02 | **+0.19** | +0.11 | +0.17 |
| 维度 | 1024 | 1024 | 1024 | 1536 |

**发现**：

1. **Nova MME 不适合纯文本意图匹配**。作为多模态模型，它的文本-文本相似度分数压缩在 0.37-0.70 的窄区间，区分度仅 +0.02，几乎无法区分相关和不相关查询。初始阈值设为 0.85 时完全无法命中，降到 0.65 才勉强可用。

2. **Titan Embed v2 区分度最好**（+0.19）。相关查询分数高（0.60-0.80），不相关查询分数极低（0.15-0.28），阈值设在 0.45 左右即可很好地分开。且维度 1024、成本最低。

3. **Cohere Multilingual v3 语义理解最强**。对间接相关的查询（如"服务器状态"→ 0.67）理解最好，但不相关查询分数也偏高（0.44-0.56），容易误命中。

4. **Cohere v4 不相关分压得最低**（0.10），但相关分也偏低（0.49-0.56），且维度 1536 更大。

**结论**：纯文本意图匹配场景推荐 **Titan Embed v2**，区分度大、阈值好调、成本低。当前版本使用 Nova MME（阈值 0.65），后续可切换。

### 11.6 工作流程

**学习**（Agent 渲染后自动触发）：
1. 用户 submit → Agent 处理 → 调用 `a2ui_render`
2. `a2ui_render` execute 中检测到 `lastUserInput` 非空
3. 调用 `matcher.learn(text, renderParams, agentId)`
4. Embedder 生成向量 → VectorStore 写入内存 → 异步写回 S3

**匹配**（用户 submit 时优先触发）：
1. 用户 submit "查看系统信息"
2. action handler 检测到 matcher 可用
3. 调用 `matcher.match(text)`
4. Embedder 生成查询向量 → VectorStore 余弦搜索
5. 命中（score > threshold）→ 直接 `executeRender(cached)` → 推送到前端
6. 未命中 → fallback 到 Agent LLM

### 11.7 配置

当前版本硬编码默认开启（避免 OpenClaw 插件配置校验问题）：

```
bucket:    clawui-rag-store (S3)
region:    us-east-1
threshold: 0.65
dimension: 1024
model:     amazon.nova-2-multimodal-embeddings-v1:0
```

---

## 12. 变更记录

| 版本 | 日期 | 变更内容 |
|-----|------|---------|
| v0.1 | 2026-03-23 | 初版设计文档 |
| v0.3 | 2026-03-24 | 新增 RAG 意图缓存设计、Embedding 模型选型对比 |

---

*文档结束*
