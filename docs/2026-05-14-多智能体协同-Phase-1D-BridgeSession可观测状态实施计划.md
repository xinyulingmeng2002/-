# Phase 1D Bridge Session 可观测状态实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让房主在桥接会话面板中一眼判断外部 Agent 是否稳定在线、监听是否异常、下一步该怎么处理。

**Architecture:** 不改服务端 bridge session 协议，不改 adapter 心跳 payload，只在 Web 面板把既有 `health` 与 `diagnostics` 派生为房主可读状态。该状态属于 Phase 1D 长期运行可观测性增强，不改变 Agent 群聊同权主线。

**Tech Stack:** React, TypeScript, Vitest, Testing Library.

---

## 背景

Phase 1B 已经打通房间钥匙、BridgeSession、heartbeat、diagnostics。Phase 1C 已经强化多 Agent 群聊成员感、提及/回复/附件体验，并完成工程侧收束。Phase 1D 的重点转向真实长期运行与接入稳定性。

当前面板已经显示：

- `health.state`
- `health.reason`
- `lastSeenSecondsAgo`
- `expiresInSeconds`
- `lastEventId`
- `reconnectCount`
- `consecutiveFailures`
- `lastError`

但这些字段仍偏工程原始数据。房主需要的是更直接的结论和行动提示。

## 本轮范围

- 增加桥接会话稳定性摘要。
- 在线且无连续失败：显示“监听正常”。
- 在线但有连续失败或最近错误：显示“监听异常”，提示检查 adapter watch 或网络。
- 离线/心跳过期：显示“心跳过期”，提示重启 adapter 或强制断连后重新接入。
- 保留原有 diagnostics 原始字段，便于排查。

## 非目标

- 不新增服务端字段。
- 不改变 adapter 心跳协议。
- 不实现自动重连策略。
- 不实现告警系统。
- 不自动回应消息。

## 任务 1：测试桥接会话可观测状态

**Files:**

- Modify: `apps/web/src/test/agent-panel.test.tsx`

- [x] **Step 1: Write the failing test**

在现有 `AgentPanel` 测试中断言：

- 在线且有 `Cursor`、无连续失败时显示“监听正常”。
- 在线但 `consecutiveFailures > 0` 或 `lastError` 时显示“监听异常”与检查提示。
- `heartbeat_expired` 时显示“心跳过期”与重启/断连提示。

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-panel.test.tsx
```

Expected: FAIL because 可观测状态文案尚未渲染。

## 任务 2：实现最小 UI 派生状态

**Files:**

- Modify: `apps/web/src/features/agents/agent-panel.tsx`

- [x] **Step 1: Add a small helper**

新增 `resolveBridgeObservation(session)`，只从 `health` 和 `diagnostics` 派生：

- `title`
- `detail`
- `tone`

- [x] **Step 2: Render inside each bridge session card**

在 bridge session 卡片中显示状态摘要，保持原有字段展示不变。

- [x] **Step 3: Run focused test**

Run:

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-panel.test.tsx
```

Expected: PASS.

## 任务 3：记录与验收

**Files:**

- Create: `docs/2026-05-14-多智能体协同-Phase-1D-BridgeSession可观测状态实施记录.md`

- [x] **Step 1: Write implementation record**

记录目标、改动范围、验证命令和后续边界。

- [x] **Step 2: Run final verification**

Run:

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-panel.test.tsx
npm --workspace @ma/web run typecheck
git diff --check
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/agents/agent-panel.tsx \
  apps/web/src/test/agent-panel.test.tsx \
  docs/2026-05-14-多智能体协同-Phase-1D-BridgeSession可观测状态实施计划.md \
  docs/2026-05-14-多智能体协同-Phase-1D-BridgeSession可观测状态实施记录.md

git commit -m "feat: improve bridge session observability"
git push origin main
```
