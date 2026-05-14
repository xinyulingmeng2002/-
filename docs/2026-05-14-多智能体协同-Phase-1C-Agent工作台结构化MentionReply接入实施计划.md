# 多智能体协同 Phase 1C Agent 工作台结构化 Mention / Reply 接入实施计划

日期：2026-05-14

## 所属阶段

Phase 1C：多 Agent 群聊体验增强。

本轮承接上一轮“结构化 Mention / Reply 兼容设计”。上一轮已经让普通房间消息、协议、服务端事件、L0 work memory 和主房间 Web 输入框支持 `mentions` 与 `replyToMessageId`。本轮把这些字段接入 Agent 实战入口，避免 Agent 工作台继续只依赖文本约定。

## 主线目标

项目主线仍然是通用多智能体协同平台：

```text
房间是群聊房间
真人和 Agent 都是成员
外部 Agent 通过房间钥匙进入
群聊表达、提及、回复、附件、沉淀和治理逐步增强
```

本轮只增强公开群聊表达的机器可识别性，不做私聊、不做任务派发、不做自动回应。

## 本轮目标

1. Agent 工作台“提到我的消息”优先使用 `event.payload.mentions` 判断。
2. Agent 工作台“回复我的消息”优先使用 `event.payload.replyToMessageId` 判断，文本 `> 回复 ...` 继续作为 fallback。
3. Agent 工作台点击“对 TA 说”发送消息时保留结构化 `mentions`。
4. Agent 工作台点击“引用回复”发送消息时保留 `replyToMessageId`。
5. `/api/bridge/ingress/message` 接收并透传结构化字段，供真实外部 Agent 使用。

## 改动范围

1. `apps/web/src/features/agent-workspace/agent-workspace-page.tsx`
   - `isMentionedForAgent` 优先读取 `payload.mentions`。
   - `isReplyForAgent` 优先读取 `payload.replyToMessageId` 并对照事件列表找到原消息发言者。
   - 工作台输入状态记录待发送的结构化 mention / reply。
   - 发送后清空结构化状态。

2. `apps/web/src/features/agent-workspace/bridge-workspace-client.ts`
   - `BridgeWorkspaceMessageRequest` 支持 `mentions` 和 `replyToMessageId`。
   - POST `/api/bridge/ingress/message` 时透传可选字段。

3. `apps/server/src/routes/bridge-ingress.ts`
   - `message` ingress 接收并校验 `mentions` 和 `replyToMessageId`。
   - 调用 `bridgeService.sendMessage` 时透传结构化字段。

4. `apps/server/src/domain/bridges/bridge-service.ts`
   - `sendMessage` 输入透传结构化字段到 message service。

5. 测试
   - `apps/web/src/test/agent-workspace-page.test.tsx`
   - `apps/web/src/test/bridge-workspace-client.test.tsx`
   - `apps/server/test/bridge-ingress.test.ts`

## 不做事项

1. 不实现私聊或消息可见性隔离。
2. 不做未读计数。
3. 不做点击跳转定位。
4. 不要求所有 adapter CLI 立即生成结构化字段。
5. 不改变 `events watch` cursor 和重连策略。

## TDD 验证计划

### Step 1：Web 工作台测试红灯

新增测试：

- `mentions: [{ participantId: "agent-codex-main", displayName: "Codex" }]` 即使正文没有 `@Codex`，也应进入“提到我的消息”。
- `replyToMessageId` 指向当前 Agent 发出的原消息时，即使正文没有 `> 回复 ...`，也应进入“回复我的消息”。
- 点击“对 OpenClaw 说”后发送消息应带 `mentions`。
- 点击“引用回复”后发送消息应带 `replyToMessageId`。

预期：失败，因为当前只用文本规则聚合，发送也只带 `body`。

### Step 2：Bridge client 测试红灯

新增测试：`sendBridgeWorkspaceMessage` 请求体应包含可选 `mentions` 和 `replyToMessageId`。

预期：失败，因为当前 client 只发送 `body` 和 `attachments`。

### Step 3：Bridge ingress 测试红灯

新增测试：`/api/bridge/ingress/message` 收到结构化字段后，返回的 `message.created` payload 应保留这些字段。

预期：失败，因为当前 route 和 bridge service 不透传。

### Step 4：最小实现

按改动范围补字段、校验和透传，不重构 UI。

## 验收标准

1. 旧的纯文本 mention / reply 仍能被工作台识别。
2. 新的结构化 `mentions` / `replyToMessageId` 能被工作台识别。
3. Agent 工作台发送 mention / reply 时透传结构化字段。
4. Bridge ingress 可接受并写入结构化字段。
5. 不影响附件发送、私有记忆候选和工作台轮询。

## 验证命令

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-workspace-page.test.tsx apps/web/src/test/bridge-workspace-client.test.tsx
npm --workspace @ma/server test -- --run apps/server/test/bridge-ingress.test.ts
npm --workspace @ma/web run typecheck
npm --workspace @ma/server run typecheck
git diff --check
```
