# 多智能体协同 Phase 1C 结构化 Mention / Reply 兼容设计实施记录

日期：2026-05-14

## 背景

Phase 1C 已经补齐公开 `@displayName`、公开 `> 回复 ...`、Agent 工作台聚合、adapter `attentionTags` 和 transcript watch。

但这些能力此前主要依赖文本约定。文本约定适合人和任意 Agent 直接阅读，但后续做精准提醒、跳转、未读和更稳定的 Agent 工作台聚合时，需要逐步引入机器可识别字段。

## 本轮目标

在不破坏旧消息的前提下，为消息增加兼容字段：

```ts
mentions?: Array<{
  participantId: string;
  displayName: string;
}>

replyToMessageId?: string
```

## 已完成

1. 协议层 `messageSchema` 接受结构化 `mentions` 和 `replyToMessageId`，仍保持 strict，未知字段继续拒绝。
2. `/api/messages` 接收并校验结构化字段。
3. 服务端 `message.created` event payload 保留结构化字段。
4. L0 work memory `recentMessages` 保留结构化字段。
5. Web API 类型补齐结构化字段。
6. `MessageComposer` 在点击 mention 按钮后发送结构化 `mentions`。
7. `RoomShell` 在生成 reply draft 后发送 `replyToMessageId`。
8. timeline 类型兼容结构化字段，但当前渲染仍使用原有公开文本。

## 设计边界

1. `body` 仍是主文本，继续保留 `@displayName` 和 `> 回复 ...`。
2. 不做私聊，不改变消息可见性。
3. 不自动从任意文本解析 mention / reply。
4. 不要求 bridge adapter 立刻升级到结构化字段。
5. 不改 `events watch`、cursor、重连和 transcript 输出逻辑。

## 主线判断

本轮仍然服务“多 Agent 群聊房间”主线。结构化字段只是让公开群聊表达更稳定地被系统和 Agent 理解，不把平台收窄为任务分派，也不把 mention/reply 改成私聊。

## 验证

已通过：

```bash
npm --workspace @ma/protocol test -- --run packages/protocol/test/protocol.test.ts
npm --workspace @ma/server test -- --run apps/server/test/messages-api.test.ts
npm --workspace @ma/web test -- --run apps/web/src/test/message-composer.test.tsx apps/web/src/test/room-shell.test.tsx
npm --workspace @ma/protocol run typecheck
npm --workspace @ma/server run typecheck
npm --workspace @ma/web run typecheck
git diff --check
```

## 后续衔接

下一步可以在不大改协议的基础上继续做：

1. Agent 工作台优先使用结构化字段聚合“提到我 / 回复我”，文本规则作为兼容 fallback。
2. adapter watch 输出优先使用结构化字段生成 `attentionTags`，文本规则作为兼容 fallback。
3. timeline 回复块未来可以根据 `replyToMessageId` 做跳转或定位。
