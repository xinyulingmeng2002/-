# Phase 1D Agent 邀请提示词产品化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让房主创建邀请钥匙后，可以直接把一段清晰提示词发给任意外部 AI/Agent，使其理解如何作为群聊成员接入房间并长期监听。

**Architecture:** 不改变 invite JSON、bridge token、服务端 API 或 adapter 协议，只增强 Web 端 TokenManager 的接入说明。提示词作为产品化辅助文本，服务于“任意 Agent 拿钥匙入群”的主线。

**Tech Stack:** React, TypeScript, Vitest, Testing Library.

---

## 背景

当前 TokenManager 已展示：

- invite JSON。
- 本机 adapter 命令。
- transcript watch 命令。
- message send 命令。
- session stop 命令。

但用户最初设想是把“链接 / 标识 / 令牌”直接发给正在运行上下文的外部 Agent。外部 Agent 不一定知道自己应该如何理解这段 invite，也不一定知道它在平台里的定位是“群聊成员”而不是任务执行器。

## 本轮范围

- 在 invite 创建成功后新增“发给外部 Agent 的接入提示词”。
- 明确外部 Agent 的定位：作为同一房间的群聊成员接入，不冒充真人。
- 明确最小操作：
  - 保存 invite JSON。
  - 使用对应 adapter 启动 session。
  - 保持 `events watch --format transcript` 长期运行。
  - 可以主动发言。
  - 断连时向房主说明，并重新接入。
- 保留现有 runbook 和命令。

## 非目标

- 不新增复制按钮。
- 不新增二维码或外链分发。
- 不改变 invite 包结构。
- 不实现跨设备 token 同步。

## 任务 1：失败测试

**Files:**

- Modify: `apps/web/src/test/agent-panel.test.tsx`

- [x] **Step 1: Write the failing assertions**

在创建 token 后断言：

- 出现 `发给外部 Agent 的接入提示词`。
- 出现 `你将作为多智能体协同房间里的 Agent 群成员接入`。
- 出现 `不要冒充真人用户`。
- 出现 `保持 events watch --format transcript 长期运行`。
- 出现 `如果断连或报错，请把错误和最近 Cursor 告诉房主`。

- [x] **Step 2: Run focused test**

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-panel.test.tsx
```

Expected: FAIL because 提示词尚未渲染。

## 任务 2：最小实现

**Files:**

- Modify: `apps/web/src/features/agents/token-manager.tsx`

- [x] **Step 1: Add prompt block**

在 invite JSON 与 runbook 之间渲染一段可复制的提示词。

- [x] **Step 2: Keep wording generic**

提示词不能绑定 Codex/OpenClaw；只能把当前 bridge kind 作为 adapter 命令提示。

- [x] **Step 3: Run focused test**

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-panel.test.tsx
```

Expected: PASS.

## 任务 3：记录与验证

**Files:**

- Create: `docs/2026-05-14-多智能体协同-Phase-1D-Agent邀请提示词产品化实施记录.md`
- Modify: `README.md`

- [x] **Step 1: Write implementation record**

记录目标、范围、验证命令与后续边界。

- [x] **Step 2: Run final verification**

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-panel.test.tsx
npm --workspace @ma/web run typecheck
git diff --check
```

- [ ] **Step 3: Commit**

```bash
git add README.md \
  apps/web/src/features/agents/token-manager.tsx \
  apps/web/src/test/agent-panel.test.tsx \
  docs/2026-05-14-多智能体协同-Phase-1D-Agent邀请提示词产品化实施计划.md \
  docs/2026-05-14-多智能体协同-Phase-1D-Agent邀请提示词产品化实施记录.md

git commit -m "feat: add agent invite handoff prompt"
git push origin main
```
