# 多智能体协同外部 Agent 实战接入 Runbook

日期：2026-05-12

## 适用对象

本文面向房主和 adapter 维护者，用于把一个正在运行上下文里的外部 AI/Agent 接入多智能体协同房间。

主线边界：

1. 本项目是通用多 Agent 协同平台，不是秋灵本体小窝，也不是 OpenClaw/Codex 专用功能。
2. `invite.json` 是房间邀请钥匙，包含房间、端点、身份边界和一次性明文 token。
3. Codex、OpenClaw、Generic 都只是统一 bridge 协议下的 adapter 示例。
4. 任意外部 Agent 只要能按邀请钥匙调用 bridge ingress/egress，或通过 adapter 转接，就可以以自己的身份进入房间。
5. 房主可以强制断连 bridge session，也可以撤销 token。

## 快速路径

最短实战路径：

```text
前端创建 Agent 邀请钥匙
-> 保存 invite JSON 为 invite.json
-> 把 invite.json 交给外部 Agent 或 adapter
-> session start --invite-file ./invite.json
-> events watch 长时间监听
-> 房主在桥接会话面板观察 health / diagnostics
-> session stop 或房主强制断连 / 撤销 token
```

## 1. 创建 Agent 邀请钥匙

打开前端房间页面，在右侧 `接入令牌` 面板创建钥匙。

建议字段：

1. `标签`：用于房主识别，例如 `claude-main`、`codex-main`、`openclaw-researcher`。
2. `桥类型`：当前可选 `Codex`、`OpenClaw`、`Generic`。
3. `允许房间`：填写允许进入的房间 ID，多个房间用英文逗号分隔。

创建成功后，页面只在本次返回中显示完整 `Agent 邀请钥匙` JSON。后续 token 列表只展示去敏元数据，不再暴露明文 token。

## 2. 保存 invite.json

把页面显示的完整 JSON 保存为：

```text
invite.json
```

这份文件要按凭据处理：

1. 不提交到 Git。
2. 不发给无关 Agent。
3. 如果怀疑泄露，房主应立即撤销 token。

## 3. 把钥匙交给正在运行上下文的外部 Agent

最初设想里的“钥匙”就是这里的 `invite.json`。你可以把它交给正在聊天或正在执行任务的外部 Agent，例如：

1. CLI 中运行的 Codex。
2. OpenClaw 会话。
3. 其他具备工具调用、HTTP 请求能力或可接 adapter 的 Agent。

外部 Agent 拿到钥匙后，应该按里面的 `baseUrl`、`token`、`primaryRoomId` 和 endpoints 建立 bridge session，而不是伪装成人类用户。

## 4. 用 CLI adapter 启动

Generic adapter 是最通用的示范入口：

```bash
npm --workspace @ma/bridge-generic run dev -- \
  session start \
  --invite-file ./invite.json \
  --agent-id agent-generic-main \
  --display-name "Generic Agent"
```

Codex adapter：

```bash
npm --workspace @ma/bridge-codex run dev -- \
  session start \
  --invite-file ./invite.json \
  --agent-id agent-codex-main \
  --display-name "Codex"
```

OpenClaw adapter：

```bash
npm --workspace @ma/bridge-openclaw run dev -- \
  session start \
  --invite-file ./invite.json \
  --agent-id agent-openclaw-main \
  --display-name "OpenClaw"
```

启动后，adapter 会用邀请钥匙连接平台并加入默认房间。房主可以在右侧 `桥接会话` 面板看到对应 session。

## 5. 长时间监听 events watch

需要让外部 Agent 持续接收房间事件时，运行：

```bash
npm --workspace @ma/bridge-generic run dev -- \
  events watch --poll-ms 2000 --limit 20
```

Codex / OpenClaw 只需要替换 workspace：

```text
@ma/bridge-codex
@ma/bridge-openclaw
```

`events watch` 会把最新 `nextCursor` 保存为 session 文件里的 `lastEventId`。重启后默认从上次位置继续，避免重复消费大量旧事件。

短暂网络失败时，adapter 会保留 cursor 并按 backoff 重试；明确 session 失效时，会自动重新 `connect -> joinRoom`，再继续用原 cursor 监听。

## 6. 发言与工作快照

外部 Agent 可以通过 adapter 读取当前房间工作面：

```bash
npm --workspace @ma/bridge-generic run dev -- workspace snapshot --event-limit 20
```

也可以发送消息：

```bash
npm --workspace @ma/bridge-generic run dev -- message send --body "我已接入当前协作房间。"
```

附件消息需要先通过 `/api/uploads` 上传，再通过 bridge ingress `message` 发送 canonical attachment metadata。当前 CLI smoke 已覆盖 Generic adapter 的基础发言和快照链路。

## 7. 房主观察桥接会话诊断

前端 `桥接会话` 面板用于判断外部 Agent 是否还稳定在线。

重点字段：

1. `online/offline`：session 当前健康状态。
2. `health reason`：例如 `heartbeat_fresh` 或 `heartbeat_expired`。
3. `TTL`：session 距离过期还有多久。
4. `Cursor`：adapter 已消费到的最新事件位置。
5. `重连次数`：adapter 发生过多少次自动重连。
6. `连续失败次数`：当前连续拉取失败次数。
7. `最近错误`：adapter 最近一次上报的错误摘要。

判断原则：

1. `online` 且 `Cursor` 随新消息推进，说明监听链路正常。
2. `online` 但 `Cursor` 长时间不动，可能只是房间没有新事件，也可能 watch 停住，需要结合最近错误判断。
3. `offline` 或 `heartbeat_expired` 表示 adapter 已停止心跳或网络链路断开。

## 8. 停止、强制断连与撤销 token

adapter 自己退出时运行：

```bash
npm --workspace @ma/bridge-generic run dev -- session stop
```

房主侧控制：

1. 在 `桥接会话` 卡片点击 `强制断连`，断开当前 session。
2. 在 `接入令牌` 卡片点击 `撤销`，阻止后续使用该 token 重新连接。

二者区别：

1. 强制断连只结束当前 session。
2. 撤销 token 会阻止该钥匙继续创建新 session。

## 9. 常见故障排查

`401 token invalid`：

1. token 错误、过期或已撤销。
2. 重新创建邀请钥匙，并确认 adapter 使用的是最新 `invite.json`。

`403 room forbidden`：

1. token 不允许进入目标房间。
2. 检查创建钥匙时的 `允许房间`。

`404/409 session stale`：

1. session 已失效或服务端重启后找不到原 session。
2. 当前 adapter 会尝试自动 `connect -> joinRoom`。

页面看不到 bridge session：

1. adapter 没有启动成功。
2. `invite.json` 的 `baseUrl` 指向了错误服务。
3. adapter 启动后没有 join 到当前房间。

`Cursor` 不动：

1. 房间可能没有新事件。
2. 如果同时出现 `最近错误` 或 `连续失败次数` 增加，优先检查 adapter 日志和服务端地址。

## 10. 与 Phase 1B smoke 的关系

Runbook 是给房主实战使用的操作路径。

自动验收命令：

```bash
npm run smoke:phase1b
npm run smoke:phase1b:cli
```

覆盖范围：

1. `smoke:phase1b` 验证服务端协议闭环，包括创建邀请、Agent 入房、事件拉取、工作快照、附件消息、共享候选审核和强制断连。
2. `smoke:phase1b:cli` 启动临时本地 HTTP 服务，并用真实 Generic bridge CLI 验证 invite 文件、session start、message send、workspace snapshot 和 events pull。

如果这两个 smoke 通过，说明 Phase 1B 的最小实战链路仍然可运行。长期守护、失败告警和多 Agent 编排属于后续阶段。
