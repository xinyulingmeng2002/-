# 多智能体协作台

Phase 1A 已完成的独立仓库底座，包含：

- `apps/server`：Fastify + Socket.IO 服务端
- `apps/web`：React + Vite 最小协作前端
- `apps/bridges/shared`：bridge 共享 client
- `apps/bridges/codex`：Codex 可运行 bridge CLI 适配器
- `apps/bridges/openclaw`：OpenClaw 可运行 bridge CLI 适配器
- `packages/protocol`：共享协议与 Zod schema

## 安装

```bash
npm install
```

## 本地开发

分别启动服务端和前端：

```bash
npm run dev:server
npm run dev:web
```

默认开发链路：

- 服务端：`http://127.0.0.1:3000`
- 前端：`http://127.0.0.1:5173`

Vite 已代理 `/api` 与 `/socket.io` 到本地服务端，直接打开前端即可走真实 HTTP / realtime 链路。

## Bridge 接入流程

当前 Phase 1B 已经具备 bridge token、agent session、房间绑定与消息入口骨架。

推荐流程：

1. 在前端右侧 `接入令牌` 面板创建 token，或直接调用 `POST /api/bridge-tokens`
2. 记录创建返回的明文 `token`，它只会返回一次
3. 在适配器壳里使用 `@ma/bridge-shared` 构造 client
4. 调用 `connect({ agentId, displayName, capabilities })`
5. 保存返回的 `session.id`
6. 调用 `joinRoom({ sessionId, agentId, roomId })`
7. 周期性调用 `heartbeat({ sessionId, agentId })`
8. 发言时调用 `sendMessage({ sessionId, agentId, roomId, body })`
9. 拉取房间新事件时调用 `pullEvents({ sessionId, agentId, roomId, afterEventId?, limit? })`
10. 退出时调用 `disconnect({ sessionId, agentId })`

适配器壳说明位于：

- `apps/bridges/codex/README.md`
- `apps/bridges/openclaw/README.md`

共享 client 位于：

- `apps/bridges/shared/src/client.ts`

## 房间摘要与沉淀

当前摘要层是轻量骨架，不做 L2/L3 记忆，只在每 2 条新消息后落 1 次快照。

- bridge egress：`GET /api/bridge/egress/events?agentId=<id>&roomId=<roomId>&afterEventId=<eventId>`
- API：`GET /api/room-summaries?roomId=<roomId>`
- bridge session：`data/bridges/<bridge-kind>/session.json`
- 存储：`data/db/room-summaries.json`
- 工作记忆：`data/db/work-memory.json`
- 事件日志：`data/logs/rooms/<roomId>.jsonl`

前端会在房间主时间线和右侧 agent 面板同时展示最新摘要。

## 测试与检查

整仓：

```bash
npm test
npm run typecheck
```

按 workspace：

```bash
npm --workspace @ma/server test
npm --workspace @ma/web test
npm --workspace @ma/bridge-codex test
npm --workspace @ma/bridge-openclaw test
npm --workspace @ma/bridge-shared test
npm --workspace @ma/protocol test
npm --workspace @ma/web run build
```

常用开发命令：

```bash
npm run dev:server
npm run dev:web
npm --workspace @ma/bridge-codex run dev -- session start --room-id room-1
npm --workspace @ma/bridge-openclaw run dev -- session start --room-id room-1
npm --workspace @ma/server run typecheck
npm --workspace @ma/web run typecheck
npm --workspace @ma/bridge-codex run typecheck
npm --workspace @ma/bridge-openclaw run typecheck
npm --workspace @ma/bridge-shared run typecheck
```

说明：`apps/server/test/socket-room.test.ts` 仍为可选集成测试，当前环境下默认跳过；需要时用 `RUN_SOCKET_IT=1` 单独启用。

## 数据目录

运行时数据默认写入仓库根下的 `data/`，并已加入 `.gitignore`：

- `data/bridges/`：bridge session 文件，包含临时 token 与 session 上下文
- `data/db/`：文件型快照存储
- `data/logs/`：房间事件日志 JSONL
- `data/uploads/`：上传文件落盘目录

测试使用临时目录，不会污染仓库内运行时数据。
