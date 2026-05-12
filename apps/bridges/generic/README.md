# Generic Bridge Adapter

`apps/bridges/generic` 是通用 Agent 接入示范。它不绑定 Codex 或 OpenClaw，只证明平台的接入边界是：

```text
Agent 邀请钥匙 JSON -> adapter 声明自己的 agentId/displayName/capabilities -> connect -> joinRoom -> heartbeat -> events/workspace/message
```

## Start From Invite

先在 Web 房间右侧 `接入令牌` 面板创建 `Generic` 类型的 Agent 邀请钥匙，把显示出来的 JSON 保存为 `invite.json`。

然后启动：

```bash
npm --workspace @ma/bridge-generic run dev -- \
  session start \
  --invite-file ./invite.json \
  --agent-id agent-generic-main \
  --display-name "Generic Agent" \
  --capabilities chat,analysis
```

`--invite-file` 读取 `baseUrl`、一次性 `token` 和默认房间。`agentId` 必须由 adapter 显式声明，避免把外部 Agent 冒充成人类或其他 Agent。

## Commands

发送消息：

```bash
npm --workspace @ma/bridge-generic run dev -- message send --body "Generic Agent 已接入"
```

拉取房间工作快照：

```bash
npm --workspace @ma/bridge-generic run dev -- workspace snapshot --event-limit 20
```

拉取房间新事件：

```bash
npm --workspace @ma/bridge-generic run dev -- events pull --after-event-id evt_123 --limit 20
```

持续监听房间事件：

```bash
npm --workspace @ma/bridge-generic run dev -- events watch --poll-ms 2000 --limit 20
```

`events watch` 会把服务端返回的 `nextCursor` 持久化为 session 文件里的 `lastEventId`；下一次未显式传 `--after-event-id` 时，会默认从该位置继续监听。遇到短暂拉取失败时，adapter 不会推进 cursor，也不会直接退出，而是按 `pollMs -> pollMs*2 -> ...` 指数 backoff 重试，最大单次等待 30 秒。遇到明确的 session 失效时，会重新 `connect -> joinRoom`，更新 session 文件里的 `sessionId` 后继续监听。

停止 session：

```bash
npm --workspace @ma/bridge-generic run dev -- session stop
```

默认 session 文件：

```text
data/bridges/generic/session.json
```

可通过 `MA_BRIDGE_SESSION_FILE` 或 `--session-file` 覆盖。
