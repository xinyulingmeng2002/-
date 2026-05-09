# 多智能体协作台 Bridge / Phase 1B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把平台推进到可长期真实使用的完整骨架，补齐 bridge token 接入、agent 在线与房间绑定、摘要快照沉淀，以及 Codex / OpenClaw 适配器壳。

**Architecture:** 保持 `apps/server` 为 canonical state，新增 token 化 bridge gateway 入口与参与者 / 会话存储；Web 增加 agent 面板与 token 管理；`apps/bridges/*` 只保留适配器壳与共享 client，不把外部运行时协议写死进核心。记忆层只增加摘要快照入口，不做重量级语义系统。

**Tech Stack:** Node.js 22, npm workspaces, TypeScript, Fastify, Socket.IO, React, Vite, Vitest, Testing Library, Zod

---

## 2026-05-09 Execution Status

本计划中的 bridge token、session、agent participant、ingress、egress、room summary、Web agent panel、token manager、shared bridge client、Codex/OpenClaw adapter 壳已经随 PR #2 合并到 `main`。

执行结果没有完全按本计划的 Task 拆分逐个提交，而是随 Phase 1A 基础线、附件一致性、记忆与观察者框架、`L3` 私有记忆受控工作面共同收口。

后续不要从 Task 1 重新执行本计划。若继续 Phase 1B，应基于当前 `main` 重新写一个更窄的计划，聚焦：

1. Agent 专用工作入口
2. 真实 bridge 长期接入体验
3. Agent 读取房间上下文、提交候选、回写状态的工作流
4. 公共面板与 Agent 私有工作面的权限分离

## Scope Decision

本计划只覆盖 `Phase 1B`：

1. bridge token 与接入会话
2. agent participant 注册与房间绑定
3. server bridge ingress
4. web agent 管理面板
5. room summary snapshot 沉淀
6. codex / openclaw adapter 壳

以下内容明确不进入本计划：

1. 真实 OpenClaw / Codex 运行时协议绑定
2. 向量检索与私有记忆插件
3. 外部搜索与主动学习执行器
4. 实时语音 / 视频通话

## File Structure Lock-In

### Root

- Modify: `package.json`
- Modify: `vitest.config.ts`
- Modify: `vitest.workspace.ts`
- Modify: `README.md`

### Shared Protocol

- Create: `packages/protocol/src/bridge.ts`
- Modify: `packages/protocol/src/index.ts`
- Test: `packages/protocol/test/bridge-protocol.test.ts`

### Server

- Create: `apps/server/src/domain/participants/participant-store.ts`
- Create: `apps/server/src/domain/bridges/bridge-token-store.ts`
- Create: `apps/server/src/domain/bridges/bridge-session-store.ts`
- Create: `apps/server/src/domain/bridges/bridge-service.ts`
- Create: `apps/server/src/domain/memory/room-summary-store.ts`
- Modify: `apps/server/src/domain/messages/message-service.ts`
- Modify: `apps/server/src/app.ts`
- Create: `apps/server/src/routes/participants.ts`
- Create: `apps/server/src/routes/bridge-tokens.ts`
- Create: `apps/server/src/routes/bridge-sessions.ts`
- Create: `apps/server/src/routes/bridge-ingress.ts`
- Create: `apps/server/src/routes/room-summaries.ts`
- Test: `apps/server/test/participants-api.test.ts`
- Test: `apps/server/test/bridge-tokens-api.test.ts`
- Test: `apps/server/test/bridge-sessions-api.test.ts`
- Test: `apps/server/test/bridge-ingress.test.ts`
- Test: `apps/server/test/room-summary.test.ts`

### Web

- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/features/rooms/room-shell.tsx`
- Create: `apps/web/src/features/agents/agent-panel.tsx`
- Create: `apps/web/src/features/agents/token-manager.tsx`
- Create: `apps/web/src/test/agent-panel.test.tsx`

### Bridges

- Create: `apps/bridges/shared/package.json`
- Create: `apps/bridges/shared/tsconfig.json`
- Create: `apps/bridges/shared/vitest.config.ts`
- Create: `apps/bridges/shared/src/config.ts`
- Create: `apps/bridges/shared/src/client.ts`
- Create: `apps/bridges/shared/test/client.test.ts`
- Create: `apps/bridges/codex/README.md`
- Create: `apps/bridges/openclaw/README.md`

## Implementation Notes

1. `apps/server` 继续作为事实中心，不新拆 gateway 进程。
2. bridge token 只存 hash，不存明文。
3. agent 加入房间后，消息仍走既有 message pipeline。
4. 摘要快照只是补充视图，不替代事件日志与工作记忆。
5. Web 管理面板只展示真实 token / session / participant 数据。
6. 根 `package.json` workspaces、根 `vitest.config.ts` projects 与 `vitest.workspace.ts` 必须扩到 `apps/bridges/*`，否则 bridge 包不会进入统一验证。

### Task 1: Extend Shared Bridge Protocol

**Files:**
- Create: `packages/protocol/src/bridge.ts`
- Modify: `packages/protocol/src/index.ts`
- Test: `packages/protocol/test/bridge-protocol.test.ts`

- [ ] **Step 1: Write the failing bridge protocol test**

```ts
import { describe, expect, it } from "vitest";
import { bridgeTokenSchema, bridgeSessionSchema } from "../src";

describe("bridge protocol", () => {
  it("requires bridge kind and status", () => {
    expect(() => bridgeTokenSchema.parse({ id: "t1" })).toThrow();
    expect(() => bridgeSessionSchema.parse({ id: "s1" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @ma/protocol test -- --run packages/protocol/test/bridge-protocol.test.ts`
Expected: FAIL because schema file does not exist

- [ ] **Step 3: Implement bridge schemas and exports**

```ts
export const bridgeTokenSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  bridgeKind: z.enum(["codex", "openclaw", "generic"]),
  allowedRoomIds: z.array(z.string()),
  createdAt: z.string(),
  revokedAt: z.string().nullable()
}).strict();
```

```ts
export const bridgeSessionSchema = z.object({
  id: z.string(),
  tokenId: z.string(),
  agentId: z.string(),
  status: z.enum(["connected", "disconnected"]),
  activeRoomIds: z.array(z.string()),
  connectedAt: z.string(),
  lastSeenAt: z.string()
}).strict();
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm --workspace @ma/protocol test -- --run packages/protocol/test/bridge-protocol.test.ts`
Expected: PASS

Run: `npm --workspace @ma/protocol run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/protocol
git commit -m "feat: add bridge protocol schemas"
```

### Task 2: Add Participant, Token, and Session Stores

**Files:**
- Create: `apps/server/src/domain/participants/participant-store.ts`
- Create: `apps/server/src/domain/bridges/bridge-token-store.ts`
- Create: `apps/server/src/domain/bridges/bridge-session-store.ts`
- Create: `apps/server/src/routes/participants.ts`
- Create: `apps/server/src/routes/bridge-tokens.ts`
- Create: `apps/server/src/routes/bridge-sessions.ts`
- Modify: `apps/server/src/app.ts`
- Test: `apps/server/test/participants-api.test.ts`
- Test: `apps/server/test/bridge-tokens-api.test.ts`
- Test: `apps/server/test/bridge-sessions-api.test.ts`

- [ ] **Step 1: Write the failing token API test**

```ts
it("creates a bridge token and lists it without exposing the secret", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/bridge-tokens",
    payload: { label: "Codex bridge", bridgeKind: "codex" }
  });

  expect(response.statusCode).toBe(201);
  expect(response.json()).toEqual(
    expect.objectContaining({
      token: expect.any(String),
      metadata: expect.objectContaining({ bridgeKind: "codex" })
    })
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @ma/server test -- --run apps/server/test/bridge-tokens-api.test.ts`
Expected: FAIL because route/store do not exist

- [ ] **Step 3: Implement JSON-backed stores**

Store files under:

- `data/db/participants.json`
- `data/db/bridge-tokens.json`
- `data/db/bridge-sessions.json`

Requirements:

1. token secret only returned at creation time
2. persisted metadata only stores secret hash
3. sessions track `connectedAt`, `lastSeenAt`, and `expiresAt`
4. `GET /api/bridge-sessions` must derive `connected` / `disconnected` from heartbeat freshness

- [ ] **Step 4: Add participant, token, and session routes**

Expose:

```ts
app.get("/api/participants", ...)
app.get("/api/bridge-tokens", ...)
app.post("/api/bridge-tokens", ...)
app.post("/api/bridge-tokens/:id/revoke", ...)
app.get("/api/bridge-sessions", ...)
```

- [ ] **Step 5: Run tests**

Run: `npm --workspace @ma/server test -- --run apps/server/test/participants-api.test.ts apps/server/test/bridge-tokens-api.test.ts apps/server/test/bridge-sessions-api.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/server
git commit -m "feat: add bridge token and participant stores"
```

### Task 3: Add Bridge Ingress and Agent Room Binding

**Files:**
- Create: `apps/server/src/domain/bridges/bridge-service.ts`
- Create: `apps/server/src/routes/bridge-ingress.ts`
- Modify: `apps/server/src/app.ts`
- Test: `apps/server/test/bridge-ingress.test.ts`

- [ ] **Step 1: Write the failing ingress test**

```ts
it("binds an agent to a room and appends a canonical message event", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/bridge/ingress/message",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      agentId: "agent-codex",
      roomId: "room-1",
      displayName: "Codex",
      body: "Bridge ingress message"
    }
  });

  expect(response.statusCode).toBe(201);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @ma/server test -- --run apps/server/test/bridge-ingress.test.ts`
Expected: FAIL because ingress route does not exist

- [ ] **Step 3: Implement bridge service**

Responsibilities:

1. authenticate token
2. register / refresh agent participant
3. upsert active bridge session
4. bind agent to room
5. append message through existing `MessageService`
6. refresh session TTL on heartbeat
7. mark session disconnected on explicit disconnect or heartbeat expiry

- [ ] **Step 4: Add ingress routes**

Expose:

```ts
app.post("/api/bridge/ingress/connect", ...)
app.post("/api/bridge/ingress/heartbeat", ...)
app.post("/api/bridge/ingress/disconnect", ...)
app.post("/api/bridge/ingress/join-room", ...)
app.post("/api/bridge/ingress/message", ...)
```

- [ ] **Step 5: Run tests and full server suite**

Run: `npm --workspace @ma/server test -- --run apps/server/test/bridge-ingress.test.ts`
Expected: PASS

Run: `npm --workspace @ma/server test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/server
git commit -m "feat: add bridge ingress pipeline"
```

### Task 4: Add Room Summary Snapshots and Read API

**Files:**
- Create: `apps/server/src/domain/memory/room-summary-store.ts`
- Create: `apps/server/src/routes/room-summaries.ts`
- Modify: `apps/server/src/domain/messages/message-service.ts`
- Modify: `apps/server/src/app.ts`
- Test: `apps/server/test/room-summary.test.ts`

- [ ] **Step 1: Write the failing room summary test**

```ts
it("writes a room summary snapshot and lists it back", async () => {
  await service.appendChatMessage({ roomId: "room-1", speakerParticipantId: "human-1", body: "A" });
  await service.appendChatMessage({ roomId: "room-1", speakerParticipantId: "agent-1", body: "B" });

  const response = await app.inject({ method: "GET", url: "/api/room-summaries?roomId=room-1" });
  expect(response.statusCode).toBe(200);
  expect(response.json().items[0]).toEqual(
    expect.objectContaining({
      roomId: "room-1",
      messageCount: 2
    })
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @ma/server test -- --run apps/server/test/room-summary.test.ts`
Expected: FAIL because summary store and route are missing

- [ ] **Step 3: Implement minimal snapshot policy**

Policy:

1. first snapshot after every 2 new messages
2. summary text is stub-based, not LLM-generated
3. snapshot stored in `data/db/room-summaries.json`

- [ ] **Step 4: Add list route**

Expose:

```ts
app.get("/api/room-summaries", ...)
```

- [ ] **Step 5: Run tests**

Run: `npm --workspace @ma/server test -- --run apps/server/test/room-summary.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/server
git commit -m "feat: add room summary snapshots"
```

### Task 5: Add Web Agent Panel and Token Manager

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/features/rooms/room-shell.tsx`
- Create: `apps/web/src/features/agents/agent-panel.tsx`
- Create: `apps/web/src/features/agents/token-manager.tsx`
- Create: `apps/web/src/test/agent-panel.test.tsx`

- [ ] **Step 1: Write the failing web agent panel test**

```tsx
it("renders online agents and bridge token actions", async () => {
  render(<AgentPanel agents={[{ id: "agent-codex", displayName: "Codex", status: "connected" }]} />);
  expect(screen.getByText("Codex")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "创建接入令牌" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @ma/web test -- --run apps/web/src/test/agent-panel.test.tsx`
Expected: FAIL because panel does not exist

- [ ] **Step 3: Extend API client**

Add:

1. `listParticipants()`
2. `listBridgeTokens()`
3. `createBridgeToken()`
4. `revokeBridgeToken()`
5. `listBridgeSessions()`
6. `listRoomSummaries()`

- [ ] **Step 4: Implement Web UI**

Requirements:

1. room shell shows online human / agent participants
2. dedicated agent panel shows bridge status
3. token manager can create and revoke tokens
4. room shell can show latest summary snapshot

- [ ] **Step 5: Run web tests**

Run: `npm --workspace @ma/web test -- --run apps/web/src/test/agent-panel.test.tsx apps/web/src/test/app.test.tsx apps/web/src/test/room-shell.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat: add bridge control web panel"
```

### Task 6: Add Shared Bridge Client and Adapter Shells

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.ts`
- Modify: `vitest.workspace.ts`
- Create: `apps/bridges/shared/package.json`
- Create: `apps/bridges/shared/tsconfig.json`
- Create: `apps/bridges/shared/vitest.config.ts`
- Create: `apps/bridges/shared/src/config.ts`
- Create: `apps/bridges/shared/src/client.ts`
- Create: `apps/bridges/shared/test/client.test.ts`
- Create: `apps/bridges/codex/README.md`
- Create: `apps/bridges/openclaw/README.md`

- [ ] **Step 1: Write the failing shared client test**

```ts
it("builds authenticated bridge requests from token config", async () => {
  const client = createBridgeClient({ baseUrl: "http://127.0.0.1:3000", token: "secret" });
  expect(client.headers()).toEqual({ authorization: "Bearer secret" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @ma/bridge-shared test -- --run apps/bridges/shared/test/client.test.ts`
Expected: FAIL because package does not exist

- [ ] **Step 3: Expand root workspace coverage**

Update:

1. root `package.json` workspaces to include `apps/bridges/*`
2. root `vitest.config.ts` projects to include `apps/bridges/*/vitest.config.ts`
3. root `vitest.workspace.ts` to include `apps/bridges/*/vitest.config.ts`

- [ ] **Step 4: Implement shared bridge client**

Responsibilities:

1. token-based request headers
2. `connect`
3. `heartbeat`
4. `disconnect`
5. `joinRoom`
6. `sendMessage`

- [ ] **Step 5: Add adapter shell docs**

Each adapter README must document:

1. required token
2. base URL
3. room join flow
4. mapping from external runtime identity to platform `agent_id`

- [ ] **Step 6: Run tests**

Run: `npm --workspace @ma/bridge-shared test -- --run apps/bridges/shared/test/client.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add package.json vitest.config.ts vitest.workspace.ts apps/bridges
git commit -m "feat: add bridge adapter shells"
```

### Task 7: Final Verification and Runbook Update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update local run instructions**

Add:

1. bridge token creation flow
2. adapter shell location
3. room summary snapshot location
4. development command list

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm --workspace @ma/web run build
```

Expected: PASS

- [ ] **Step 3: Verify working tree cleanliness**

Run: `git status --short`
Expected: only intended tracked changes remain

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add bridge phase 1b runbook"
```
