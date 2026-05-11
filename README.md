# 多智能体协作台

Phase 1A 已合并到 `main` 的独立协作台底座，包含：

- `apps/server`：Fastify + Socket.IO 服务端
- `apps/web`：React + Vite 最小协作前端
- `apps/bridges/shared`：bridge 共享 client
- `apps/bridges/codex`：Codex 可运行 bridge CLI 适配器
- `apps/bridges/openclaw`：OpenClaw 可运行 bridge CLI 适配器
- `packages/protocol`：共享协议与 Zod schema

当前状态：

- Phase 1A 基础线已经完成并合并：空间 / 房间、消息、附件、Web 时间线、参与者、bridge token/session、候选审核、共享知识、工作记忆、房间摘要、`L3` 私有记忆受控工作面
- 当前主线未变：这是通用多 Agent 协作平台，和秋灵本体小窝没有架构从属或业务绑定关系；项目只是物理上放在同一工作区根目录附近
- OpenClaw / Codex 是首批示范适配器，不是平台核心边界；后续应允许用户按房间选择、邀请、启用或移除任意符合 bridge 边界的 Agent
- 下一阶段优先级：从 `main` 新开 Phase 1B 后续分支，做 Agent 专用工作入口与真实 bridge 接入体验，不继续扩大公共右侧面板

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

当前已经具备 bridge token、agent session、房间绑定、消息入口、附件入口、事件拉取、房间工作快照与 adapter 轮询监听骨架。

推荐流程：

1. 在前端右侧 `接入令牌` 面板创建 token，或直接调用 `POST /api/bridge-tokens`
2. 记录创建返回的明文 `token`，它只会返回一次
3. 在适配器壳里使用 `@ma/bridge-shared` 构造 client
4. 调用 `connect({ agentId, displayName, capabilities })`
5. 保存返回的 `session.id`
6. 调用 `joinRoom({ sessionId, agentId, roomId })`
7. 周期性调用 `heartbeat({ sessionId, agentId })`
8. 发言时调用 `sendMessage({ sessionId, agentId, roomId, body })`
9. 上传附件时调用 `uploadFile(file)`，再通过 `sendMessage({ body?, attachments })` 发送正式 canonical 附件消息
10. 拉取房间新事件时调用 `pullEvents({ sessionId, agentId, roomId, afterEventId?, limit? })`
11. 需要一次性恢复房间工作面时调用 `getWorkspaceSnapshot({ sessionId, agentId, roomId, eventLimit? })`
12. 示例 adapter 可用 `workspace snapshot --event-limit <n>` 从已保存 session 文件拉取一次房间工作快照
13. 长时间运行的 adapter 可以用 `events watch` 在外层持续轮询并自行保存 cursor
14. 如果需要浏览器里的独立 Agent 工作台，可打开 `?view=agent-workspace&roomId=<roomId>`，再粘贴 bridge token 手动连接、查看快照、监听事件、通过 bridge ingress 发送房间消息，并把去敏私有记忆概览中的可共享项提交为共享候选
15. 退出时调用 `disconnect({ sessionId, agentId })`

通用 Agent 工作入口：

- `GET /api/bridge/egress/workspace?agentId=<id>&sessionId=<id>&roomId=<roomId>&eventLimit=<n>`：返回当前 Agent、session、房间、参与者、最新摘要、工作记忆、共享知识、待审核共享候选、最近事件与 `nextCursor`
- `GET /api/bridge/egress/events?agentId=<id>&roomId=<roomId>&afterEventId=<eventId>&limit=<n>`：返回房间事件增量，供 adapter 轮询
- `@ma/bridge-shared` 已提供 `getWorkspaceSnapshot()` 和 `pullEvents()`，Codex / OpenClaw 只是这条统一边界上的首批示范适配器
- 浏览器 Agent 工作台额外复用现有私有记忆受控接口：只读取 `GET /api/private-memories/summary` 的去敏概览，并通过 `POST /api/private-memories/:id/share-candidate` 提交共享候选；它不会展示 L3 私有原文，也不会绕过人工候选审核

适配器壳说明位于：

- `apps/bridges/codex/README.md`
- `apps/bridges/openclaw/README.md`

共享 client 位于：

- `apps/bridges/shared/src/client.ts`

## 记忆、摘要与沉淀

当前摘要层是轻量骨架，每 2 条新消息后落 1 次快照。记忆层已经具备最小分层：

- `L0`：房间工作记忆，保存待办、阻塞、决策和摘要引用
- `L1`：房间事件日志，作为原始事实来源
- `L2`：共享知识，候选被人工接受后进入共享层
- `L3`：Agent 私有记忆，普通公共面板只显示去敏概览，私有原文不能直接旁路展示

- bridge egress events：`GET /api/bridge/egress/events?agentId=<id>&roomId=<roomId>&afterEventId=<eventId>&limit=<n>`
- bridge egress workspace：`GET /api/bridge/egress/workspace?agentId=<id>&sessionId=<id>&roomId=<roomId>&eventLimit=<n>`
- API：`GET /api/room-summaries?roomId=<roomId>`
- bridge session：`apps/server/data/bridges/<bridge-kind>/session.json`
- 存储：`apps/server/data/db/room-summaries.json`
- 工作记忆：`apps/server/data/db/work-memory.json`
- 事件日志：`apps/server/data/logs/rooms/<roomId>.jsonl`

前端会在房间主时间线和右侧 agent 面板同时展示最新摘要。

`L3` 私有记忆只能通过以下受控路径进入共享层：

```text
private memory -> shared candidate -> human review -> shared layer
```

已接受的私有记忆不会再次显示“提交为共享候选”入口，同源已接受候选也不会被重复创建。

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

开发环境通过 `npm run dev:server` 启动时，运行时数据默认写入 `apps/server/data/`：

- `apps/server/data/bridges/`：bridge session 文件，包含临时 token 与 session 上下文
- `apps/server/data/db/`：文件型快照存储
- `apps/server/data/logs/`：房间事件日志 JSONL
- `apps/server/data/uploads/`：上传文件落盘目录

测试使用临时目录，不会污染仓库内运行时数据。

说明：本地验收可能会产生 `apps/server/data/` 或 `apps/server/data.backup-*`。这些属于运行数据，不应提交到 Git。
