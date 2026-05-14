# 多智能体协同 Phase 1C Adapter 结构化 AttentionTags 实施计划

日期：2026-05-14

## 所属阶段

Phase 1C：多 Agent 群聊体验增强。

本轮承接结构化 `mentions` / `replyToMessageId` 已接入普通消息、Agent 工作台和 bridge ingress 之后的 adapter 侧补齐。

## 主线目标

继续服务通用多 Agent 群聊房间：外部 Agent 通过房间钥匙进入后，可以稳定知道哪些公开群聊消息提到自己、哪些消息回复自己。

## 本轮目标

1. 三套 adapter 的 `events watch` 生成 `attentionTags` 时优先读取 `payload.mentions`。
2. 若当前 watch 批次里包含被回复的原消息，则用 `payload.replyToMessageId` 对照原消息发言者，识别 `reply-to-you`。
3. 旧文本规则继续作为 fallback：
   - `@displayName` / `@agentId`
   - `> 回复 displayName:` / `> 回复 agentId:`
4. 不改变 cursor、重连、transcript 输出和 session 文件格式。

## 设计边界

`replyToMessageId` 只是消息 id。adapter 如果没有本地事件历史，无法仅凭一个 id 判断它是不是回复当前 Agent。因此本轮只在当前 batch 内做可靠对照；跨批次历史索引留到后续独立切片。

## 改动范围

1. `apps/bridges/codex/src/runtime.ts`
2. `apps/bridges/openclaw/src/runtime.ts`
3. `apps/bridges/generic/src/runtime.ts`
4. 三套 runtime 测试
5. 三套 adapter README 对结构化字段识别边界做说明

## TDD 验证计划

1. 先在三套 runtime 测试中加入结构化 `mentions` 和 batch 内 `replyToMessageId` 用例。
2. 运行测试确认失败。
3. 最小实现：
   - `mentions` 直接匹配当前 session 的 `agentId` 或 `displayName`。
   - `replyToMessageId` 在当前 batch items 中查找原消息，原消息发言者是当前 session agent 时标记 `reply-to-you`。
   - 文本匹配 fallback 不变。
4. 运行三套 runtime 测试和 typecheck。

## 验证命令

```bash
npm --workspace @ma/bridge-codex test -- --run apps/bridges/codex/test/runtime.test.ts
npm --workspace @ma/bridge-openclaw test -- --run apps/bridges/openclaw/test/runtime.test.ts
npm --workspace @ma/bridge-generic test -- --run apps/bridges/generic/test/runtime.test.ts
npm --workspace @ma/bridge-codex run typecheck
npm --workspace @ma/bridge-openclaw run typecheck
npm --workspace @ma/bridge-generic run typecheck
git diff --check
```
