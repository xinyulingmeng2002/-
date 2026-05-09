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

`message send` 依赖已存在的 session 文件，所以需要先成功执行一次 `session start`。

拉取新事件：

```bash
npm --workspace @ma/bridge-codex run dev -- events pull --after-event-id evt_123 --limit 20
```

如果不传 `--room-id`，默认读取 session 文件里的当前房间；如果不传 `--after-event-id`，会返回当前房间最近一批事件。
如果传入的 `--after-event-id` 已失效，服务端会回退到最近一批事件并返回新的 `nextCursor`，避免轮询卡死。

发送附件：

```bash
npm --workspace @ma/bridge-codex run dev -- attachment send --file ./demo.png --caption "请看图片"
```

也可以显式传 mime type：

```bash
npm --workspace @ma/bridge-codex run dev -- attachment send --file ./clip.mp4 --mime-type video/mp4
```

这个命令会先上传文件，再自动发送一条包含附件 URL 的 canonical 消息，所以图片、音频、视频、gif、普通文件都能先通过统一链接进入房间时间线。

也支持 stdin：

```bash
printf '这是从 stdin 进入平台的消息\n' | npm --workspace @ma/bridge-codex run dev -- message send
```

停止 session：

```bash
npm --workspace @ma/bridge-codex run dev -- session stop
```

`session stop` 同样读取已保存的 session 文件；如果想换位置，启动和停止时要使用同一个 `MA_BRIDGE_SESSION_FILE` 或 `--session-file`。

默认 session 文件位置：

```text
data/bridges/codex/session.json
```

该文件包含临时 token 与 session 元数据，默认已被仓库 `.gitignore` 忽略。可通过 `MA_BRIDGE_SESSION_FILE` 或 `--session-file` 覆盖。

## Join Room Flow

推荐流程：

1. `connect({ agentId, displayName, capabilities })`
2. 保存返回的 `session.id`
3. `joinRoom({ sessionId, agentId, roomId })`
4. 房间存活期间周期性 `heartbeat({ sessionId, agentId })`
5. `sendMessage({ sessionId, agentId, roomId, body })`
6. `uploadFile(file)` 后把附件 URL 作为 canonical message 发进房间
7. `pullEvents({ sessionId, agentId, roomId, afterEventId?, limit? })`
8. 退出时 `disconnect({ sessionId, agentId })`

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
