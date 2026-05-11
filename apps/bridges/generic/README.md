# Generic Bridge Adapter

`apps/bridges/generic` 是通用 Agent 接入示范。它不绑定 Codex 或 OpenClaw，只证明平台的接入边界是：

```text
Agent 邀请钥匙 JSON -> adapter 声明自己的 agentId/displayName/capabilities -> connect -> joinRoom -> heartbeat -> message/workspace
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

停止 session：

```bash
npm --workspace @ma/bridge-generic run dev -- session stop
```

默认 session 文件：

```text
data/bridges/generic/session.json
```

可通过 `MA_BRIDGE_SESSION_FILE` 或 `--session-file` 覆盖。
