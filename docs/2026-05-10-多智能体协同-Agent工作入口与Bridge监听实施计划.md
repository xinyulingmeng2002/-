# Agent Workspace Snapshot And Bridge Watch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the next multi-Agent collaboration loop: any bridged Agent can fetch a room-scoped workspace snapshot and continuously watch room events through the same bridge boundary.

**Architecture:** Keep `apps/server` as canonical state. Add a bridge egress workspace snapshot route that reuses bridge token/session/room authorization, then expose it through `@ma/bridge-shared`; add `events watch` to Codex/OpenClaw demo adapters as a polling loop over existing `pullEvents`, with cursor persistence left to stdout/consumer for this first slice.

**Tech Stack:** Node.js 22, TypeScript, Fastify, npm workspaces, Vitest, JSON file storage.

---

## Scope

In scope:

1. Server bridge egress workspace snapshot for a joined room.
2. Shared bridge client method for the snapshot.
3. `events watch` command in `apps/bridges/codex` and `apps/bridges/openclaw`.
4. README updates documenting the generic Agent flow.

Out of scope:

1. Agent private memory full UI.
2. Semantic search / embeddings.
3. Login or multi-tenant permissions.
4. Telegram / OpenClaw internal runtime binding.
5. Persistent watch cursor file. The first version emits JSON events and the caller can store cursor externally.

## File Map

- Modify: `apps/server/src/domain/bridges/bridge-service.ts`
- Modify: `apps/server/src/routes/bridge-egress.ts`
- Test: `apps/server/test/bridge-egress.test.ts`
- Modify: `apps/bridges/shared/src/client.ts`
- Test: `apps/bridges/shared/test/client.test.ts`
- Modify: `apps/bridges/codex/src/config.ts`
- Modify: `apps/bridges/codex/src/runtime.ts`
- Modify: `apps/bridges/codex/src/cli.ts`
- Test: `apps/bridges/codex/test/config.test.ts`
- Test: `apps/bridges/codex/test/runtime.test.ts`
- Modify: `apps/bridges/openclaw/src/config.ts`
- Modify: `apps/bridges/openclaw/src/runtime.ts`
- Modify: `apps/bridges/openclaw/src/cli.ts`
- Test: `apps/bridges/openclaw/test/config.test.ts`
- Test: `apps/bridges/openclaw/test/runtime.test.ts`
- Modify: `README.md`
- Modify: `apps/bridges/codex/README.md`
- Modify: `apps/bridges/openclaw/README.md`

## Snapshot Shape

`GET /api/bridge/egress/workspace?agentId=<id>&sessionId=<id>&roomId=<roomId>&eventLimit=<n>`

Response:

```ts
{
  agent: {
    id: string;
    displayName: string;
    capabilities: string[];
  };
  session: {
    id: string;
    activeRoomIds: string[];
    lastSeenAt: string;
    expiresAt: string;
  };
  room: {
    id: string;
  };
  participants: Array<{
    id: string;
    type: "human" | "agent" | "bridge" | "system";
    displayName: string;
    bridgeKind: "codex" | "openclaw" | "generic" | null;
    capabilities: string[];
    lastSeenAt: string;
  }>;
  latestSummary: RoomSummaryRecord | null;
  workMemory: WorkMemoryRecord | null;
  sharedKnowledge: SharedKnowledgeRecord[];
  recentEvents: RoomEventRecord[];
  nextCursor: string | null;
}
```

## Tasks

### Task 1: Server Workspace Snapshot

**Files:**
- Modify: `apps/server/src/domain/bridges/bridge-service.ts`
- Modify: `apps/server/src/routes/bridge-egress.ts`
- Test: `apps/server/test/bridge-egress.test.ts`

- [x] **Step 1: Write failing server test**

Add a test that:

1. Creates a bridge token for `room-1`.
2. Connects `agent-codex`.
3. Joins `room-1`.
4. Creates a human message and a bridge message.
5. Accepts or seeds shared/work-memory state through existing message flow.
6. Calls `GET /api/bridge/egress/workspace?agentId=agent-codex&sessionId=<id>&roomId=room-1&eventLimit=10`.
7. Expects agent/session/room/recentEvents/latestSummary/workMemory/participants to be present.

Run:

```bash
npm --workspace @ma/server test -- --run apps/server/test/bridge-egress.test.ts
```

Expected: FAIL because `/api/bridge/egress/workspace` does not exist.

- [x] **Step 2: Implement snapshot service and route**

Add `getWorkspaceSnapshot()` to `BridgeService`. Reuse `authenticate`, `assertRoomAllowed`, `resolveSession`, session heartbeat, and participant `lastSeenAt` update from `pullRoomEvents`.

Add `GET /api/bridge/egress/workspace` route to `bridge-egress.ts`, with validation for `agentId`, `sessionId`, `roomId`, and optional `eventLimit`.

- [x] **Step 3: Verify server test passes**

Run:

```bash
npm --workspace @ma/server test -- --run apps/server/test/bridge-egress.test.ts
```

Expected: PASS.

### Task 2: Shared Bridge Client

**Files:**
- Modify: `apps/bridges/shared/src/client.ts`
- Test: `apps/bridges/shared/test/client.test.ts`

- [x] **Step 1: Write failing shared client test**

Add a test asserting `getWorkspaceSnapshot()` sends:

```text
GET /api/bridge/egress/workspace?agentId=agent-codex&sessionId=session-1&roomId=room-1&eventLimit=20
```

Run:

```bash
npm --workspace @ma/bridge-shared test -- --run apps/bridges/shared/test/client.test.ts
```

Expected: FAIL because method is missing.

- [x] **Step 2: Implement shared client method**

Add input type and method:

```ts
getWorkspaceSnapshot<T>(input: WorkspaceSnapshotInput): Promise<T>
```

- [x] **Step 3: Verify shared client test passes**

Run:

```bash
npm --workspace @ma/bridge-shared test -- --run apps/bridges/shared/test/client.test.ts
```

Expected: PASS.

### Task 3: Codex Bridge Watch

**Files:**
- Modify: `apps/bridges/codex/src/config.ts`
- Modify: `apps/bridges/codex/src/runtime.ts`
- Modify: `apps/bridges/codex/src/cli.ts`
- Test: `apps/bridges/codex/test/config.test.ts`
- Test: `apps/bridges/codex/test/runtime.test.ts`

- [x] **Step 1: Write failing config and runtime tests**

Config test parses:

```bash
events watch --after-event-id evt-1 --limit 20 --poll-ms 500
```

Runtime test uses fake timers and a fake client. It should call `pullEvents` repeatedly, emit each non-empty response through an injected `onBatch`, and advance cursor from `nextCursor`.

Run:

```bash
npm --workspace @ma/bridge-codex test -- --run apps/bridges/codex/test/config.test.ts apps/bridges/codex/test/runtime.test.ts
```

Expected: FAIL because command/runtime are missing.

- [x] **Step 2: Implement Codex watch**

Add `watchCodexBridgeEvents()` with injectable `pollMs`, `AbortSignal`, `setTimeoutFn`, `clearTimeoutFn`, and `onBatch`.

CLI behavior:

1. `events watch` loads session file.
2. Polls until `SIGINT` / `SIGTERM`.
3. Prints each batch as JSON line.

- [x] **Step 3: Verify Codex tests pass**

Run:

```bash
npm --workspace @ma/bridge-codex test
npm --workspace @ma/bridge-codex run typecheck
```

Expected: PASS.

### Task 4: OpenClaw Bridge Watch

**Files:**
- Modify: `apps/bridges/openclaw/src/config.ts`
- Modify: `apps/bridges/openclaw/src/runtime.ts`
- Modify: `apps/bridges/openclaw/src/cli.ts`
- Test: `apps/bridges/openclaw/test/config.test.ts`
- Test: `apps/bridges/openclaw/test/runtime.test.ts`

- [x] **Step 1: Mirror failing OpenClaw tests**

Mirror Codex tests with OpenClaw defaults.

Run:

```bash
npm --workspace @ma/bridge-openclaw test -- --run apps/bridges/openclaw/test/config.test.ts apps/bridges/openclaw/test/runtime.test.ts
```

Expected: FAIL because command/runtime are missing.

- [x] **Step 2: Implement OpenClaw watch**

Mirror Codex implementation while keeping package names, default display name, and error codes OpenClaw-specific.

- [x] **Step 3: Verify OpenClaw tests pass**

Run:

```bash
npm --workspace @ma/bridge-openclaw test
npm --workspace @ma/bridge-openclaw run typecheck
```

Expected: PASS.

### Task 5: Documentation And Full Verification

**Files:**
- Modify: `README.md`
- Modify: `apps/bridges/codex/README.md`
- Modify: `apps/bridges/openclaw/README.md`

- [x] **Step 1: Update docs**

Document:

1. Generic Agent join flow.
2. Workspace snapshot endpoint.
3. `events watch` command.
4. Codex/OpenClaw as examples only.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run typecheck
npm test
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps README.md docs/2026-05-10-多智能体协同-Agent工作入口与Bridge监听实施计划.md
git commit -m "feat: add agent workspace snapshot and bridge watch"
```
