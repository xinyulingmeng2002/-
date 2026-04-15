# Codex Bridge Adapter

`apps/bridges/codex` 保留为 Codex 运行时接入平台 bridge gateway 的适配器壳。实际 HTTP 调用由 `@ma/bridge-shared` 提供。

当前已经补成可实际运行的最小 CLI 适配器，入口是：

```bash
npm --workspace @ma/bridge-codex run dev -- <command>
```

## Required Config

- `token`: 通过 `POST /api/bridge-tokens` 创建，`bridgeKind` 必须是 `codex`
- `baseUrl`: 平台服务端地址，开发环境默认 `http://127.0.0.1:3000`

```ts
import { createBridgeClient } from "@ma/bridge-shared";

const client = createBridgeClient({
  baseUrl: "http://127.0.0.1:3000",
  token: process.env.MA_BRIDGE_TOKEN as string
});
```

也可以直接走环境变量：

```bash
export MA_BRIDGE_BASE_URL=http://127.0.0.1:3000
export MA_BRIDGE_TOKEN=<your-token>
export MA_BRIDGE_AGENT_ID=agent-codex-main
export MA_BRIDGE_DISPLAY_NAME=Codex
export MA_BRIDGE_ROOM_ID=room-1
export MA_BRIDGE_CAPABILITIES=chat,code
```

## Runnable Commands

启动并保活 session：

```bash
npm --workspace @ma/bridge-codex run dev -- session start --room-id room-1
```

显式指定所有参数：

```bash
npm --workspace @ma/bridge-codex run dev -- \
  session start \
  --base-url http://127.0.0.1:3000 \
  --token <your-token> \
  --agent-id agent-codex-main \
  --display-name Codex \
  --room-id room-1 \
  --capabilities chat,code \
  --heartbeat-ms 30000
```

发送消息：

```bash
npm --workspace @ma/bridge-codex run dev -- message send --body "Codex 已接入房间"
```

也支持 stdin：

```bash
printf '这是从 stdin 进入平台的消息\n' | npm --workspace @ma/bridge-codex run dev -- message send
```

停止 session：

```bash
npm --workspace @ma/bridge-codex run dev -- session stop
```

默认 session 文件位置：

```text
data/bridges/codex/session.json
```

可通过 `MA_BRIDGE_SESSION_FILE` 或 `--session-file` 覆盖。

## Join Room Flow

推荐流程：

1. `connect({ agentId, displayName, capabilities })`
2. 保存返回的 `session.id`
3. `joinRoom({ sessionId, agentId, roomId })`
4. 房间存活期间周期性 `heartbeat({ sessionId, agentId })`
5. `sendMessage({ sessionId, agentId, roomId, body })`
6. 退出时 `disconnect({ sessionId, agentId })`

`sendMessage()` 当前会在服务端补做房间绑定，但适配器仍应显式先调用 `joinRoom()`，这样 session 与房间关系更清晰，也更容易排查权限问题。

## Identity Mapping

平台里的 `agent_id` 必须稳定、可重建，不能直接依赖显示名。Codex 适配器建议把外部运行时里的稳定身份映射成：

```text
agent_id = "agent-codex-" + <stable_runtime_identity>
```

推荐把 `<stable_runtime_identity>` 取自 Codex 运行时的固定 worker / profile / automation identity；不要使用瞬时任务标题或用户可随意修改的昵称。

示例：

- 外部运行时 identity: `workspace-main`
- 平台 `agent_id`: `agent-codex-workspace-main`

`displayName` 可以继续使用更友好的展示值，例如 `Codex`.
