# AGENT.md — ClawUI Quick Reference for AI Agents

> 本文件供 AI Agent 快速了解和安装 ClawUI 插件。

## 什么是 ClawUI

OpenClaw 的 A2UI 插件。Agent 调用 `a2ui_render` tool，传模板名 + 数据，即可生成可交互界面。无需手写 A2UI JSONL。

## 安装

```bash
# 1. 克隆
git clone https://github.com/xiwan/clawui.git
cd clawui

# 2. 安装依赖
npm install

# 3. 添加到 OpenClaw 配置（~/.openclaw/config.json）
{
  "plugins": {
    "load": { "paths": ["/path/to/clawui"] },
    "entries": { "clawui": { "enabled": true } }
  }
}

# 4. 重启 Gateway
openclaw gateway restart
```

## 使用方式

Agent 调用 `a2ui_render` tool：

```json
{
  "template": "confirmation",
  "data": { "title": "Deploy?", "message": "确认部署 v1.2.3?" }
}
```

组合多个模板：

```json
{
  "templates": [
    { "template": "status_page", "data": { "title": "结果", "status": "success" } },
    { "template": "data_table", "data": { "columns": ["名称","状态"], "rows": [["API","✅"]] } }
  ]
}
```

## 可用模板

| 模板 | 用途 |
|------|------|
| `text_display` | 文本展示 |
| `form` | 动态表单 |
| `confirmation` | 确认框 |
| `booking_form` | 预订表单 |
| `search_results` | 搜索结果列表 |
| `dashboard` | 指标仪表盘 |
| `settings` | 设置面板 |
| `data_table` | 通用表格 |
| `status_page` | 操作结果反馈 |
| `detail` | 键值对详情 |
| `multi_card` | 多卡片网格 |
| `accordion` | 折叠面板 |

## 配置项

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `defaultSurfaceId` | `"main"` | 默认渲染目标 |
| `enableFallback` | `true` | 无 canvas 时降级为 Markdown |
| `customTemplatesDir` | — | 自定义模板目录 |
| `previewPort` | `19001` | Preview Server 端口 |

## 详细文档

- [设计文档](docs/DESIGN.md)
- [模板指南](docs/TEMPLATES.md)
- [集成指南](docs/INTEGRATION.md)
