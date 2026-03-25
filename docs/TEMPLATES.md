# ClawUI 模板开发指南

## 概述

ClawUI 模板是预定义的 A2UI v0.9 组件布局，Agent 通过模板名 + 数据即可生成完整的交互界面。

## 模板格式

每个模板是一个 JSON 文件，放在 `src/templates/builtin/` 或用户自定义目录下。

```json
{
  "id": "模板唯一标识",
  "version": "v0.9",
  "description": "模板描述",
  "catalogId": "https://a2ui.org/specification/v0_9/basic_catalog.json",
  "dataSchema": {
    "字段名": "类型"
  },
  "components": [
    { "id": "组件ID", "component": "组件类型", ... }
  ],
  "defaultActions": {
    "action名": { "builtin": "surface.close" }
  }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 模板唯一标识，Agent 通过此名称引用 |
| version | string | 是 | A2UI 协议版本，固定 `"v0.9"` |
| description | string | 是 | 模板用途描述 |
| catalogId | string | 否 | A2UI catalog URL，默认 basic_catalog |
| dataSchema | object | 否 | 数据字段定义，用于校验 Agent 传入的 data |
| components | array | 是 | A2UI v0.9 组件列表 |
| defaultActions | object | 否 | 默认 action 映射（Agent 可覆盖） |

## 模板变量

组件属性中可以使用 `{{变量名}}` 引用 Agent 传入的 data：

```json
{ "id": "title", "component": "Text", "text": "{{restaurant}} Reservation", "variant": "h1" }
```

数据绑定使用 A2UI 标准的 `{ "path": "/字段名" }` 语法：

```json
{ "id": "date-field", "component": "DateTimeInput", "label": "Date", "value": { "path": "/date" } }
```

区别：
- `{{变量}}` — 模板渲染时静态替换，适合标题、标签等固定文本
- `{ "path": "/..." }` — A2UI 运行时数据绑定，适合表单输入等动态值

## 可用组件

基于 A2UI v0.9 basic catalog：

| 组件 | 用途 | 关键属性 |
|------|------|----------|
| Text | 文本显示 | text, variant (h1/h2/h3/body) |
| Button | 按钮 | child, variant (primary/secondary), action |
| TextField | 文本输入 | label, value, placeholder |
| DateTimeInput | 日期时间选择 | label, value, enableDate, enableTime |
| Image | 图片 | src, alt |
| Card | 卡片容器 | child, title |
| Column | 纵向布局 | children |
| Row | 横向布局 | children |
| Divider | 分割线 | — |
| Toggle | 开关 | label, value |
| Select | 下拉选择 | label, options, value |

## Action 定义

组件的 action 属性定义用户交互行为：

```json
{
  "action": {
    "event": {
      "name": "confirm",
      "context": {
        "details": { "path": "/reservation" }
      }
    }
  }
}
```

- `name` — action 标识，ClawUI action router 根据此名称路由
- `context` — 回传数据，可引用数据模型路径

## 内置模板

### text_display

纯文本展示，最简单的模板。

```
Agent: a2ui_render({ template: "text_display", data: { text: "Hello World", title: "Greeting" } })
```

### form

通用表单，字段由 data 动态生成。

```
Agent: a2ui_render({
  template: "form",
  data: {
    title: "User Info",
    fields: [
      { name: "name", label: "Name", type: "text" },
      { name: "email", label: "Email", type: "text" }
    ]
  },
  actions: { submit: { tool: "message", action: "send", argMapping: { message: "{{context}}" } } }
})
```

### confirmation

确认对话框，两个按钮。

```
Agent: a2ui_render({
  template: "confirmation",
  data: { title: "Confirm Action", message: "Are you sure?", confirmLabel: "Yes", cancelLabel: "No" },
  actions: { confirm: { tool: "message", action: "send", argMapping: {...} }, cancel: { builtin: "surface.close" } }
})
```

### search_results

搜索结果列表，每项为一个 Card。

```
Agent: a2ui_render({
  template: "search_results",
  data: {
    query: "Italian restaurants",
    results: [
      { title: "Pasta House", subtitle: "4.5★", description: "..." },
      { title: "Pizza Roma", subtitle: "4.2★", description: "..." }
    ]
  }
})
```

## 自定义模板

1. 创建 JSON 文件，遵循上述格式
2. 放到配置的 `customTemplatesDir` 目录
3. 重启 Gateway 或调用 `openclaw clawui reload`
4. Agent 即可通过 `template: "你的模板ID"` 使用

## 模板预览

```bash
# 列出所有可用模板
openclaw clawui list

# 预览模板生成的 JSONL
openclaw clawui preview booking_form --data '{"restaurant":"Test","guests":2}'

# 推送到 canvas 预览
openclaw clawui push booking_form --data '{"restaurant":"Test","guests":2}' --node my-mac
```
