# 多智能体协同 Phase 1C Adapter 重点事件输出实施计划

日期：2026-05-14

## 所属阶段

Phase 1C：多 Agent 群聊体验增强。

本轮承接 Phase 1C 复盘建议，不继续深挖 UI 细节，而是回到“外部 Agent 被邀请进房间后能稳定参与群聊”的实战链路。

## 主线目标

用户最初设想是把房间钥匙或标识交给正在运行上下文里的外部 AI/Agent，让它们像人一样进入同一个房间交流。

因此，外部 adapter 的 `events watch` 不应只是输出原始事件批次，还应帮助 Agent 稳定识别重点群聊事件：

```text
有人 @ 我
有人公开回复我
```

本轮目标是在不自动回应、不做任务派发、不扩后端协议的前提下，为 watch 输出增加轻量结构化标记。

## 输出设计

当 watch 批次中的事件满足条件时，在该事件对象上增加：

```json
{
  "attentionTags": ["mentioned-you"]
}
```

或：

```json
{
  "attentionTags": ["reply-to-you"]
}
```

同一事件如果同时满足多个条件，可以同时带多个 tag。

## 识别规则

### mentioned-you

当 `payload.body` 中出现当前 Agent 的公开 mention：

```text
@<displayName>
@<agentId>
```

并且 mention 后面是空白、句末或常见中英文标点时，标记为 `mentioned-you`。

### reply-to-you

当 `payload.body` 以公开回复引用开头：

```text
> 回复 <displayName>:
> 回复 <agentId>:
```

则标记为 `reply-to-you`。

## 设计取舍

本轮只增强 adapter watch 输出，不修改服务端事件协议。

理由：

1. `message.body` 仍然保持对任意 Agent 可读。
2. adapter 输出是外部 Agent 最直接看到的上下文层。
3. 不需要等待结构化 mention / reply schema 落地。
4. 不会引入自动回应，也不会把平台变成任务分派系统。

## 本轮范围

1. Codex adapter `events watch` 输出重点事件 tag。
2. OpenClaw adapter `events watch` 输出重点事件 tag。
3. Generic adapter `events watch` 输出重点事件 tag。
4. 三套 adapter README 记录 `attentionTags`。
5. 为三套 runtime 测试覆盖 mention 和 reply 标记。

## 不做事项

1. 不自动发送任何回应。
2. 不改变 cursor 持久化逻辑。
3. 不改变 pull events API。
4. 不修改服务端消息 schema。
5. 不做复杂通知策略、未读计数或任务编排。

## 文件改动计划

1. `apps/bridges/codex/src/runtime.ts`
   - watch 批次输出前为重点事件添加 `attentionTags`。

2. `apps/bridges/openclaw/src/runtime.ts`
   - 同步 Codex adapter 行为。

3. `apps/bridges/generic/src/runtime.ts`
   - 同步 Codex adapter 行为。

4. `apps/bridges/*/test/runtime.test.ts`
   - 覆盖 `mentioned-you` 和 `reply-to-you`。

5. `apps/bridges/*/README.md`
   - 说明 watch 输出中 `attentionTags` 的含义。

## TDD 验证计划

### Step 1：写失败测试

先在 Codex runtime 测试中断言 watch 输出会给提及和回复事件加 tag。

预期：失败，因为当前输出仍是原始 batch。

### Step 2：实现最小逻辑

只在 adapter 本地读取 session 中的 `agentId` / `displayName`，对 batch items 做输出前标注。

### Step 3：同步三套 adapter

Codex 通过后，同步 OpenClaw 和 Generic，保持外部 Agent 接入体验一致。

## 验收标准

1. `@Codex` / `@OpenClaw` / `@Generic Agent` 能产生 `mentioned-you`。
2. `> 回复 agent-id:` 能产生 `reply-to-you`。
3. 未命中的普通事件保持原样，不额外污染输出。
4. cursor 持久化、backoff、重连和 session 文件更新不回退。

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

## 后续衔接

完成本轮后，可以继续推进：

1. `events watch` 终端输出格式更适合 Agent 粘贴进上下文。
2. 结构化 mention / reply schema 兼容设计。
3. Agent 可配置的提醒策略，但仍不默认自动回应。
