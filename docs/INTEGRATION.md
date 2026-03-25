# ClawUI OpenClaw 集成指南

## 前提

- OpenClaw Gateway 已运行
- 至少一个 node 配对且有 canvas 能力（macOS/iOS/Android）
- OpenClaw 版本 >= 2026.1（含 canvas A2UI 支持）

## 安装

### 方式一：本地开发加载

```bash
# 在 OpenClaw 配置中添加插件路径
# ~/.openclaw/config.json
{
  "plugins": {
    "load": {
      "paths": ["/home/ec2-user/projects/clawUI"]
    },
    "entries": {
      "clawui": {
        "enabled": true,
        "config": {}
      }
    }
  }
}
```

### 方式二：npm 包私有分发（tgz）

适用于多台机器之间共享插件、不想公开发布的场景。

```bash
# 1. 构建 + 打包（在开发机上）
cd /path/to/clawUI
npm run build
npm pack
# 生成 clawui-0.1.0.tgz

# 2. 传输到目标机器（任选一种）
# 共享目录
cp clawui-0.1.0.tgz ~/workspace/shared/
# 或 scp
scp clawui-0.1.0.tgz ec2-user@<目标IP>:~/
# 或 S3 中转
aws s3 cp clawui-0.1.0.tgz s3://<bucket>/plugins/

# 3. 在目标机器上安装
openclaw plugins install ./clawui-0.1.0.tgz
```

> **注意**: `package.json` 必须包含 `openclaw.extensions` 字段，否则 OpenClaw 无法识别插件：
> ```json
> {
>   "openclaw": {
>     "extensions": {
>       "clawui": {
>         "entry": "dist/index.js",
>         "manifest": "openclaw.plugin.json"
>       }
>     }
>   }
> }
> ```

### 方式三：npm 安装（发布后）

```bash
openclaw plugins install @openclaw/clawui
```

### 重启 Gateway

```bash
openclaw gateway restart
```

### 验证

```bash
openclaw plugins list
# 应显示 clawui: enabled

openclaw plugins info clawui
```

## 配置

```json
{
  "plugins": {
    "entries": {
      "clawui": {
        "enabled": true,
        "config": {
          "defaultSurfaceId": "main",
          "enableFallback": true,
          "customTemplatesDir": "~/.openclaw/clawui-templates"
        }
      }
    }
  }
}
```

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| defaultSurfaceId | "main" | 默认 Surface ID |
| enableFallback | true | 无 canvas 时自动降级为 Markdown |
| customTemplatesDir | null | 自定义模板目录 |

## Agent Tool 使用

ClawUI 注册的 `a2ui_render` 工具对 Agent 可用。Agent 在对话中可以调用：

### 使用模板

```json
{
  "tool": "a2ui_render",
  "params": {
    "template": "booking_form",
    "data": {
      "restaurant": "Pasta House",
      "date": "2026-03-25",
      "time": "19:00",
      "guests": 2
    },
    "actions": {
      "confirm": {
        "tool": "message",
        "action": "send",
        "argMapping": {
          "channel": "discord",
          "target": "user:123",
          "message": "Booking confirmed for {{context.restaurant}}"
        }
      }
    }
  }
}
```

### 使用自定义组件

```json
{
  "tool": "a2ui_render",
  "params": {
    "components": [
      { "id": "root", "component": "Column", "children": ["msg"] },
      { "id": "msg", "component": "Text", "text": "Hello from ClawUI", "variant": "h1" }
    ],
    "surfaceId": "greeting"
  }
}
```

## Agent Tool 允许列表

如果你的 Agent 使用了工具允许列表，需要添加 `a2ui_render`：

```json
{
  "agents": {
    "list": [{
      "id": "main",
      "tools": {
        "allow": ["a2ui_render"]
      }
    }]
  }
}
```

或者按插件 ID 允许所有 ClawUI 工具：

```json
{
  "tools": {
    "allow": ["clawui"]
  }
}
```

## Action 处理流程

```
用户点击按钮
    │
    ▼
Canvas WebView 发送 userAction
    │ { name: "confirm", surfaceId: "main", context: { restaurant: "Pasta House" } }
    ▼
OpenClaw Gateway 接收
    │
    ▼
ClawUI action router 查找映射
    │ confirm → { tool: "message", action: "send", argMapping: {...} }
    ▼
替换 argMapping 中的 {{context.*}} 变量
    │ message: "Booking confirmed for Pasta House"
    ▼
调用 OpenClaw message tool
    │
    ▼
Discord/飞书/Telegram 收到消息
```

## 与已有 canvas tool 的关系

| 功能 | 已有 canvas tool | ClawUI a2ui_render |
|------|-----------------|-------------------|
| 推送 JSONL | ✅ 手写 JSONL | ✅ 模板/组件自动生成 |
| 数据填充 | ❌ 手动 | ✅ 自动 |
| Action 路由 | ❌ | ✅ 自动映射到工具 |
| 模板复用 | ❌ | ✅ 预制 + 自定义 |
| Markdown 降级 | ❌ | ✅ 自动 |
| 底层控制 | ✅ present/hide/eval/snapshot | 不涉及 |

ClawUI 不替代 canvas tool，而是在其上层提供更易用的抽象。需要底层控制（eval JS、截图等）时仍用 canvas tool。

## 与 ACP Bridge 的集成

ACP Bridge 的 Agent（Kiro/Claude/Codex）可以通过 OpenClaw tools proxy 调用 ClawUI：

```bash
# 通过 ACP Bridge tools proxy
curl -X POST http://<bridge>:18010/tools/invoke \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "a2ui_render",
    "args": {
      "template": "confirmation",
      "data": { "title": "Deploy?", "message": "Deploy v1.2.3 to production?" },
      "actions": {
        "confirm": { "tool": "exec", "argMapping": { "command": "deploy.sh v1.2.3" } }
      }
    }
  }'
```

## 故障排查

| 问题 | 原因 | 解决 |
|------|------|------|
| 插件未加载 | 路径错误或 manifest 缺失 | `openclaw plugins doctor` |
| a2ui_render 不可用 | 未加入 tools allow | 添加到允许列表 |
| 界面不显示 | node 无 canvas 能力 | 确认 node 已配对且支持 canvas |
| action 无响应 | 映射未注册 | 检查 actions 参数 |
| 降级不生效 | enableFallback 为 false | 配置中启用 |
