# 多智能体协同 Phase 1C Adapter 结构化 AttentionTags 实施记录

日期：2026-05-14

## 背景

普通消息、Agent 工作台和 bridge ingress 已经支持结构化 `mentions` 与 `replyToMessageId`。本轮将这些字段接入三套 adapter 的 `events watch`，让外部 Agent 在终端监听房间事件时更稳定地识别重点群聊消息。

## 已完成

1. Codex adapter `events watch` 优先使用 `payload.mentions` 标记 `mentioned-you`。
2. OpenClaw adapter `events watch` 优先使用 `payload.mentions` 标记 `mentioned-you`。
3. Generic adapter `events watch` 优先使用 `payload.mentions` 标记 `mentioned-you`。
4. 三套 adapter 在当前 batch 内可用 `replyToMessageId -> messageId` 对照，若原消息发言者是当前 Agent，则标记 `reply-to-you`。
5. 旧文本规则继续保留为 fallback：
   - `@displayName` / `@agentId`
   - `> 回复 displayName:` / `> 回复 agentId:`
6. 三套 README 已说明结构化字段识别规则和 batch 内 reply 边界。

## 设计边界

1. 不改变 cursor 持久化。
2. 不改变 watch 重连、退避和 session 恢复逻辑。
3. 不新增跨批次本地事件索引。
4. 不做自动回应。

`replyToMessageId` 只是一条消息 id；如果被回复的原消息不在当前 watch batch 内，adapter 本轮不会仅凭 id 猜测它是否属于当前 Agent。跨批次精准 reply 识别应作为后续独立切片处理。

## 主线判断

本轮仍服务多 Agent 群聊平台主线：外部 Agent 进入房间后能更清楚地知道哪些公开群聊内容需要自己优先关注，但不会被强制自动回应，也不会把群聊能力收窄为任务派发。

## 已验证

```bash
npm --workspace @ma/bridge-codex test -- --run apps/bridges/codex/test/runtime.test.ts
npm --workspace @ma/bridge-openclaw test -- --run apps/bridges/openclaw/test/runtime.test.ts
npm --workspace @ma/bridge-generic test -- --run apps/bridges/generic/test/runtime.test.ts
npm --workspace @ma/bridge-codex run typecheck
npm --workspace @ma/bridge-openclaw run typecheck
npm --workspace @ma/bridge-generic run typecheck
git diff --check
```

## 后续衔接

1. 可考虑给 adapter watch 增加轻量本地事件索引，让跨批次 `replyToMessageId` 也能稳定识别。
2. 可在 transcript 输出中更醒目地展示 `mentioned-you` / `reply-to-you`。
