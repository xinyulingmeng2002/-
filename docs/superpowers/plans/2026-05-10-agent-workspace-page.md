# Agent Workspace Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated browser entry for an Agent workspace so an operator can load a room-scoped snapshot, watch room events, and inspect the current Agent context without expanding the public room panel.

**Architecture:** Keep `apps/web` as the human-facing shell, but introduce a separate `AgentWorkspacePage` that is entered through query parameters and uses the bridge egress APIs with an explicit bridge token. The page should fetch a workspace snapshot, poll room events with `afterEventId`, and render a compact operational view with connection controls, current snapshot, and a streaming event log.

**Tech Stack:** React, TypeScript, Vite, Vitest, existing `ApiClient`, browser `fetch`, CSS.

---

### Task 1: Add a dedicated Agent workspace page

**Files:**
- Create: `apps/web/src/features/agent-workspace/agent-workspace-page.tsx`
- Create: `apps/web/src/features/agent-workspace/agent-workspace-page.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles/app.css`

- [x] **Step 1: Write the failing page test**

Add a test that renders the new page, enters `bridgeToken`, `agentId`, `sessionId`, and `roomId`, clicks connect, and expects a workspace snapshot section plus recent events to render.

- [x] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-workspace-page.test.tsx
```

Expected: FAIL because the page and connection flow do not exist yet.

- [x] **Step 3: Implement the page and App switch**

Add a URL-driven `AgentWorkspacePage` entry from `App.tsx`, with a compact form for bridge token and room/session identity, snapshot loading, and event polling.

- [x] **Step 4: Verify the page test passes**

Run:

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-workspace-page.test.tsx
```

Expected: PASS.

### Task 2: Add bridge workspace client helpers for the web page

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/features/agent-workspace/agent-workspace-page.tsx`
- Modify: `apps/web/src/test/agent-workspace-page.test.tsx`

- [x] **Step 1: Write the failing client-facing behavior**

Test that the page uses a small bridge client helper to call:

```text
GET /api/bridge/egress/workspace
GET /api/bridge/egress/events
```

with the supplied bridge token in `Authorization`.

- [x] **Step 2: Implement the bridge fetch helpers**

Add the minimal helper methods needed by the page. Keep them separate from the existing room/timeline `ApiClient` methods so the human room shell stays untouched.

- [x] **Step 3: Verify the focused web test passes**

Run:

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-workspace-page.test.tsx
```

Expected: PASS.

### Task 3: Polish the entry point and docs

**Files:**
- Modify: `apps/web/src/features/rooms/room-shell.tsx`
- Modify: `README.md`
- Modify: `apps/bridges/codex/README.md`
- Modify: `apps/bridges/openclaw/README.md`

- [x] **Step 1: Add a clear entry link**

Add a small link/button from the room shell to the Agent workspace page using the current room id as context.

- [x] **Step 2: Update docs**

Document the new browser entry and make clear that the workspace page is the Agent-side operational view, not a replacement for the public room panel.

- [x] **Step 3: Run full verification**

Run:

```bash
npm --workspace @ma/web test
npm run typecheck
npm test
```

Expected: PASS.
