# Phase 1D Agent 邀请复制动作实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让房主创建邀请钥匙后，可以一键复制 invite JSON 和外部 Agent 接入提示词，降低把房间钥匙交给外部 Agent 的操作摩擦。

**Architecture:** 不改变 invite JSON、bridge token、服务端 API 或 adapter 协议，只在 Web 端 TokenManager 增加浏览器剪贴板复制动作与轻量反馈。

**Tech Stack:** React, TypeScript, Vitest, Testing Library.

---

## 背景

上一切片已经生成“发给外部 Agent 的接入提示词”，但房主仍需要手动选中大段文本。Phase 1D 当前重点是让真实接入路径更顺手，因此本轮只补复制动作，不做下载、二维码或链接化分发。

## 本轮范围

- invite JSON 下方增加 `复制邀请 JSON`。
- 接入提示词下方增加 `复制接入提示词`。
- 复制成功后显示 `已复制邀请 JSON` 或 `已复制接入提示词`。
- 复制失败时显示 `复制失败，请手动复制`。

## 非目标

- 不新增下载 invite 文件。
- 不新增二维码或外链。
- 不持久保存复制状态。
- 不改变 token 暴露策略。

## 任务 1：失败测试

**Files:**

- Modify: `apps/web/src/test/agent-panel.test.tsx`

- [x] **Step 1: Mock clipboard**

用 `Object.defineProperty(navigator, "clipboard", ...)` 注入 `writeText` mock。

- [x] **Step 2: Assert copy buttons**

创建 invite 后点击：

- `复制邀请 JSON`
- `复制接入提示词`

断言 `writeText` 被调用，并出现成功反馈。

同时覆盖一次 clipboard 拒绝写入，断言出现 `复制失败，请手动复制`。

- [x] **Step 3: Run focused test**

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-panel.test.tsx
```

Expected: FAIL because buttons not rendered.

## 任务 2：最小实现

**Files:**

- Modify: `apps/web/src/features/agents/token-manager.tsx`
- Modify: `apps/web/src/styles/app.css`

- [x] **Step 1: Add copy state and helper**

新增 `copyStatus` 状态和 `handleCopy(label, content)`。

- [x] **Step 2: Render buttons**

在 invite JSON 和接入提示词后分别渲染复制按钮。

- [x] **Step 3: Run focused test**

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-panel.test.tsx
```

Expected: PASS.

## 任务 3：记录与验证

**Files:**

- Create: `docs/2026-05-14-多智能体协同-Phase-1D-Agent邀请复制动作实施记录.md`
- Modify: `README.md`

- [x] **Step 1: Write implementation record**

记录目标、范围、TDD 结果与后续边界。

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
  apps/web/src/styles/app.css \
  apps/web/src/test/agent-panel.test.tsx \
  docs/2026-05-14-多智能体协同-Phase-1D-Agent邀请复制动作实施计划.md \
  docs/2026-05-14-多智能体协同-Phase-1D-Agent邀请复制动作实施记录.md

git commit -m "feat: add invite copy actions"
git push origin main
```
