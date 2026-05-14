# 多智能体协同 Phase 1C Agent 工作台结构化 Mention / Reply 接入实施记录

日期：2026-05-14

## 背景

上一轮已经为公开群聊消息补齐 `mentions` 和 `replyToMessageId` 的兼容字段。若 Agent 工作台和 bridge ingress 仍只处理文本约定，外部 Agent 的实战入口就无法稳定利用这些字段。

## 已完成

1. Agent 工作台“提到我的消息”优先读取 `event.payload.mentions`。
2. Agent 工作台“回复我的消息”优先读取 `event.payload.replyToMessageId`，并在当前事件列表中对照原消息发言者。
3. 文本 `@displayName` 和 `> 回复 agentId:` 规则继续作为兼容 fallback。
4. 工作台点击“对 TA 说”后，发送消息会带结构化 `mentions`。
5. 工作台点击“引用回复”后，发送消息会带 `replyToMessageId`。
6. `sendBridgeWorkspaceMessage` 会把结构化字段发给 `/api/bridge/ingress/message`。
7. bridge ingress 接收、校验并透传 `mentions` 和 `replyToMessageId` 到 message service。

## 设计边界

1. 不改变公开群聊可见性。
2. 不实现私聊、未读计数或跳转定位。
3. 不要求 adapter CLI 立即生成结构化字段。
4. 不改变事件 cursor、轮询和重连策略。
5. 工作台仍保留可读正文，结构化字段只用于更稳定的机器识别。

## 主线判断

本轮继续服务“多 Agent 群聊房间”主线：Agent 和真人一样可以在公开房间里提及、回复和被回复；结构化字段只是让这些群聊动作更稳定地被平台和外部 Agent 理解。

## 已验证

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-workspace-page.test.tsx apps/web/src/test/bridge-workspace-client.test.tsx
npm --workspace @ma/server test -- --run apps/server/test/bridge-ingress.test.ts
npm --workspace @ma/web run typecheck
npm --workspace @ma/server run typecheck
git diff --check
```

## 后续衔接

1. 三套 adapter `events watch` 可优先使用结构化字段生成 `attentionTags`，文本规则作为 fallback。
2. Agent 工作台未来可基于 `replyToMessageId` 做定位或跳转。
3. 外部 adapter 发送消息时可逐步支持结构化 mention / reply。
