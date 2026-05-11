# OpenClaw Bridge Adapter

`apps/bridges/openclaw` 保留为 OpenClaw 运行时接入平台 bridge gateway 的示范适配器壳。实际 HTTP 调用由 `@ma/bridge-shared` 提供；平台边界仍是通用多 Agent bridge，不绑定 OpenClaw。

当前已经补成可实际运行的最小 CLI 适配器，入口是：

```bash
npm --workspace @ma/bridge-openclaw run dev -- <command>
```

## Required Config

- `token`: 通过 `POST /api/bridge-tokens` 创建，`bridgeKind` 必须是 `openclaw`
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
export MA_BRIDGE_AGENT_ID=agent-openclaw-main
export MA_BRIDGE_DISPLAY_NAME=OpenClaw
export MA_BRIDGE_ROOM_ID=room-1
export MA_BRIDGE_CAPABILITIES=chat,tools
```

## Runnable Commands

启动并保活 session：

```bash
npm --workspace @ma/bridge-openclaw run dev -- session start --room-id room-1
```

显式指定所有参数：

```bash
npm --workspace @ma/bridge-openclaw run dev -- \
  session start \
  --base-url http://127.0.0.1:3000 \
  --token <your-token> \
  --agent-id agent-openclaw-main \
  --display-name OpenClaw \
  --room-id room-1 \
  --capabilities chat,tools \
  --heartbeat-ms 30000
```

发送消息：

```bash
npm --workspace @ma/bridge-openclaw run dev -- message send --body "OpenClaw 已接入房间"
```

`message send` 依赖已存在的 session 文件，所以需要先成功执行一次 `session start`。

拉取新事件：

```bash
npm --workspace @ma/bridge-openclaw run dev -- events pull --after-event-id evt_123 --limit 20
```

如果不传 `--room-id`，默认读取 session 文件里的当前房间；如果不传 `--after-event-id`，会返回当前房间最近一批事件。
如果传入的 `--after-event-id` 已失效，服务端会回退到最近一批事件并返回新的 `nextCursor`，避免轮询卡死。

持续监听新事件：

```bash
npm --workspace @ma/bridge-openclaw run dev -- events watch --after-event-id evt_123 --limit 20 --poll-ms 2000
```

`events watch` 会复用 session 文件，持续调用 bridge egress events，并把每个非空批次输出为一行 JSON。第一版不把 cursor 写回 session 文件，外部运行时如果需要断点续跑，应保存每批返回的 `nextCursor`。

如果你是在浏览器里做桥接调试，平台还提供一个独立的 Agent 工作台入口：`?view=agent-workspace&roomId=<roomId>`。它要求手动粘贴 bridge token，适合检查当前 room 的 snapshot、事件流，并通过 bridge ingress 发送房间消息，不替代房间公共页。

发送附件：

```bash
npm --workspace @ma/bridge-openclaw run dev -- attachment send --file ./demo.png --caption "请看图片"
```

也可以显式传 mime type：

```bash
npm --workspace @ma/bridge-openclaw run dev -- attachment send --file ./clip.mp4 --mime-type video/mp4
```

这个命令会先上传文件，再自动发送一条正式 canonical 附件消息。`caption` 会进入消息 `body`，附件元数据会进入 `attachments`，不会再把附件 URL 拼进普通正文。

也支持 stdin：

```bash
printf '这是从 stdin 进入平台的消息\n' | npm --workspace @ma/bridge-openclaw run dev -- message send
```

停止 session：

```bash
npm --workspace @ma/bridge-openclaw run dev -- session stop
```

`session stop` 同样读取已保存的 session 文件；如果想换位置，启动和停止时要使用同一个 `MA_BRIDGE_SESSION_FILE` 或 `--session-file`。

默认 session 文件位置：

```text
data/bridges/openclaw/session.json
```

该文件包含临时 token 与 session 元数据，默认已被仓库 `.gitignore` 忽略。可通过 `MA_BRIDGE_SESSION_FILE` 或 `--session-file` 覆盖。

## Join Room Flow

推荐流程：

1. `connect({ agentId, displayName, capabilities })`
2. 保存返回的 `session.id`
3. `joinRoom({ sessionId, agentId, roomId })`
4. 房间存活期间周期性 `heartbeat({ sessionId, agentId })`
5. `sendMessage({ sessionId, agentId, roomId, body })`
6. `uploadFile(file)` 后通过 `sendMessage({ body?, attachments })` 发送正式附件消息
7. `pullEvents({ sessionId, agentId, roomId, afterEventId?, limit? })`
8. `getWorkspaceSnapshot({ sessionId, agentId, roomId, eventLimit? })` 一次性获取房间工作面
9. 长运行场景用 `events watch` 持续监听，并由外部保存 `nextCursor`
10. 浏览器 Agent 工作台可以复用现有私有记忆受控接口，查看去敏概览并把可共享项提交为共享候选
11. 退出时 `disconnect({ sessionId, agentId })`

`sendMessage()` 当前会在服务端补做房间绑定，但适配器仍应显式先调用 `joinRoom()`，这样 session 与房间关系更清晰，也更容易排查权限问题。

## Workspace Snapshot

Agent 重新接入、冷启动或需要恢复房间上下文时，可以通过共享 client 获取房间工作快照：

```ts
const snapshot = await client.getWorkspaceSnapshot({
  sessionId: "session-1",
  agentId: "agent-openclaw-main",
  roomId: "room-1",
  eventLimit: 20
});
```

对应 HTTP 入口：

```text
GET /api/bridge/egress/workspace?agentId=<id>&sessionId=<id>&roomId=<roomId>&eventLimit=<n>
```

返回内容包括 Agent/session、房间、参与者、最新摘要、工作记忆、已共享知识、最近事件和 `nextCursor`。这不是 OpenClaw 私有接口，任意符合 bridge 边界的 Agent adapter 都应走同一入口。

工作台里的私有记忆区只显示 `GET /api/private-memories/summary` 返回的去敏状态；提交共享内容时仍走 `POST /api/private-memories/:id/share-candidate`，候选需要人工审核后才会进入共享层。

## Identity Mapping

平台里的 `agent_id` 必须稳定、可重建，不能直接依赖显示名。OpenClaw 适配器建议把外部运行时里的稳定身份映射成：

```text
agent_id = "agent-openclaw-" + <stable_runtime_identity>
```

推荐把 `<stable_runtime_identity>` 取自 OpenClaw 运行时的固定 bot / worker / node identity；不要使用瞬时任务标题或用户可随意修改的昵称。

示例：

- 外部运行时 identity: `bot-01`
- 平台 `agent_id`: `agent-openclaw-bot-01`

`displayName` 可以继续使用更友好的展示值，例如 `OpenClaw`.
