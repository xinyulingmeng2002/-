# 多智能体协同 Phase 1C 结构化 Mention / Reply 兼容设计实施计划

日期：2026-05-14

## 所属阶段

Phase 1C：多 Agent 群聊体验增强。

本轮承接 Phase 1C 复盘中的“结构化 mention / reply 兼容设计”缺口。目标是让公开群聊中的 `@某成员` 和 `> 回复某消息` 在保持文本可读的同时，逐步具备机器可识别字段。

## 主线目标

项目主线仍然是通用多智能体协同平台：

```text
房间是群聊房间
真人和 Agent 都是成员
外部 Agent 通过房间钥匙进入
群聊表达、提及、回复、附件、沉淀和治理逐步增强
```

本轮不做私聊、不做任务派发、不做自动回应。结构化字段只是增强群聊消息的可识别性，为后续精准提醒、跳转、未读和 Agent 工作台聚合打基础。

## 本轮目标

新增兼容字段：

```ts
mentions?: Array<{
  participantId: string;
  displayName: string;
}>

replyToMessageId?: string
```

设计要求：

1. `message.body` 继续保持可读文本。
2. 旧消息没有字段也必须正常工作。
3. 前端现有 `对 TA 说` 和 `回复` 仍生成公开文本。
4. 同时把结构化字段随消息写入服务端事件 payload。
5. 外部 bridge / adapter 仍可只发 `body`，不强制升级。

## 改动范围

1. `packages/protocol/src/message.ts`
   - 增加 `messageMentionSchema`。
   - `messageSchema` 增加可选 `mentions` 和 `replyToMessageId`。

2. `packages/protocol/test/protocol.test.ts`
   - 覆盖结构化 mention / reply 被接受。
   - 保持 unknown keys 仍被拒绝。

3. `apps/server/src/domain/memory/work-memory-store.ts`
   - `WorkMemoryMessage` 增加可选 `mentions` 和 `replyToMessageId`。

4. `apps/server/src/domain/messages/message-service.ts`
   - `AppendChatMessageInput` 支持可选结构化字段。
   - 写入 event payload 和 work memory。

5. `apps/server/src/routes/messages.ts`
   - `/api/messages` 接收并校验结构化字段。
   - 非法 mention / reply 返回 400。

6. `apps/server/test/messages-api.test.ts`
   - 覆盖 API 创建消息时保留结构化字段。
   - 覆盖非法结构化字段被拒绝。

7. `apps/web/src/api/client.ts`
   - `MessageEventRecord` 和 `createMessage` 类型增加可选字段。

8. `apps/web/src/features/chat/message-composer.tsx`
   - `MessageComposerSubmit` 增加可选 `mentions` 和 `replyToMessageId`。
   - 点击 mention 按钮时附带结构化 mention。
   - reply draft 附带 `replyToMessageId`。

9. `apps/web/src/features/rooms/room-shell.tsx`
   - 生成 mention draft / reply draft 时带结构化字段。
   - 发送消息时透传给 API。
   - `normalizeEvent` 保留结构化字段到 timeline model。

10. `apps/web/src/features/chat/message-list.tsx`
    - `TimelineMessage` 类型增加可选字段，不改变当前渲染。

11. `apps/web/src/test/message-composer.test.tsx`
    - 覆盖 mention 和 reply submit 附带结构化字段。

12. `apps/web/src/test/room-shell.test.tsx`
    - 覆盖主房间发送 mention / reply 时调用 API 带结构化字段。

## 不做事项

1. 不自动从任意文本解析 mention / reply。
2. 不改变消息可见性，不实现私聊。
3. 不实现未读计数、跳转定位或通知策略。
4. 不要求 bridge adapter 立刻发送结构化字段。
5. 不改 `events watch` 的 cursor / reconnect 逻辑。

## TDD 验证计划

### Step 1：协议测试红灯

在 `packages/protocol/test/protocol.test.ts` 中新增测试，期望 `messageSchema` 接受：

```ts
mentions: [{ participantId: "agent-codex", displayName: "Codex" }]
replyToMessageId: "msg-1"
```

预期：失败，因为当前 schema 严格拒绝未知字段。

### Step 2：服务端测试红灯

在 `apps/server/test/messages-api.test.ts` 中新增测试，期望 `/api/messages` 创建消息后 payload 保留 `mentions` 和 `replyToMessageId`。

预期：失败，因为当前 route 和 service 不接受这些字段。

### Step 3：前端测试红灯

在 `message-composer.test.tsx` / `room-shell.test.tsx` 中新增测试，期望点击“对 Codex 说”和“回复”后发送 payload 带结构化字段。

预期：失败，因为当前只发送文本 body。

### Step 4：最小实现

按上方改动范围补字段、校验和透传，不重构 UI。

## 验收标准

1. 旧消息只带 `body` 仍通过。
2. 新消息可带 `mentions` 和 `replyToMessageId`。
3. 结构化字段进入 event payload。
4. 结构化字段进入 work memory recentMessages。
5. 前端 mention / reply 操作自动附带结构化字段。
6. 现有公开文本 `@displayName` 和 `> 回复 ...` 仍保留。

## 验证命令

```bash
npm --workspace @ma/protocol test -- --run packages/protocol/test/protocol.test.ts
npm --workspace @ma/server test -- --run apps/server/test/messages-api.test.ts
npm --workspace @ma/web test -- --run apps/web/src/test/message-composer.test.tsx apps/web/src/test/room-shell.test.tsx
npm --workspace @ma/protocol run typecheck
npm --workspace @ma/server run typecheck
npm --workspace @ma/web run typecheck
git diff --check
```
