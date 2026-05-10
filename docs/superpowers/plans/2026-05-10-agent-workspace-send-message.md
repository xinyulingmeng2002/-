# Agent Workspace Send Message Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the dedicated Agent workspace page send a room message through bridge ingress and refresh its local snapshot/event view after the send.

**Architecture:** Reuse the existing workspace page and bridge helper. Add one minimal bridge ingress helper for message sending, wire a small composer into the Agent workspace page, and refresh the page state after a successful send so the UI stays aligned with the room timeline.

**Tech Stack:** React, TypeScript, Vitest, existing browser bridge helper, existing CSS.

---

### Task 1: Add bridge message send helper

**Files:**
- Modify: `apps/web/src/features/agent-workspace/bridge-workspace-client.ts`
- Test: `apps/web/src/test/bridge-workspace-client.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a test that asserts a new helper sends `POST /api/bridge/ingress/message` with bearer token authorization, the agent/session/room fields, and the message body.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/bridge-workspace-client.test.tsx
```

Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Implement the minimal helper**

Add a single `sendBridgeWorkspaceMessage()` helper that posts to the bridge ingress message endpoint.

- [ ] **Step 4: Verify the test passes**

Run:

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/bridge-workspace-client.test.tsx
```

Expected: PASS.

### Task 2: Add a simple composer to the Agent workspace page

**Files:**
- Modify: `apps/web/src/features/agent-workspace/agent-workspace-page.tsx`
- Test: `apps/web/src/test/agent-workspace-page.test.tsx`

- [ ] **Step 1: Write the failing page test**

Add a test that connects the workspace, types a message, clicks send, and expects the message send helper to be called and the new message to appear in the event list.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-workspace-page.test.tsx
```

Expected: FAIL because the composer and send flow do not exist yet.

- [ ] **Step 3: Implement the minimal composer and send flow**

Add a small text input and send button to the Agent workspace page, call the new helper, then refresh or append the resulting event stream.

- [ ] **Step 4: Verify the test passes**

Run:

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-workspace-page.test.tsx
```

Expected: PASS.

### Task 3: Update docs and verify

**Files:**
- Modify: `README.md`
- Modify: `apps/bridges/codex/README.md`
- Modify: `apps/bridges/openclaw/README.md`

- [ ] **Step 1: Document the write path**

Document that the Agent workspace can now send room messages through bridge ingress, while still using the same independent workspace entry.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm --workspace @ma/web test
npm run typecheck
npm test
```

Expected: PASS.

