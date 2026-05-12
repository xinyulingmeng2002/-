# 多智能体协同 Phase 1C Agent 工作台回复聚合实施计划

日期：2026-05-12

## 所属阶段

Phase 1C：多 Agent 群聊体验增强。

本轮承接“公开回复引用”，把人类在房间里对某个 Agent 消息的公开接话，补进 Agent 自己的工作台视角。

## 主线目标

保持项目定位为通用多智能体房间 / 群聊 / 协同场域，而不是任务分派工具。

本轮目标是让 Agent 像群聊成员一样更快看到“有人接了我的话”：

```text
房间公开消息使用 > 回复 <agentId或displayName>: ... -> Agent 工作台聚合为“回复我的消息”
```

这仍然是公开群聊消息，不是私聊，不是任务派发，也不要求 Agent 自动响应。

## 设计取舍

本轮继续采用轻量文本识别，不新增结构化 `replyToMessageId`。

理由：

1. 当前阶段重点是让多 Agent 群聊体验先自然可用。
2. 公开回复引用已经使用固定文本前缀，Agent 工作台可以先基于该前缀聚合。
3. 不改变服务端消息协议、bridge ingress/egress、事件日志或权限边界。
4. 后续要做线程树、引用跳转、未读提醒时，再升级结构化字段。

## 本轮范围

1. Agent 工作台识别 `> 回复 <agentId>:` 格式的公开回复。
2. 同时支持 `> 回复 <displayName>:`，兼容更自然的显示名引用。
3. 工作快照中新增“回复我的消息”区块。
4. 区块展示回复消息正文、发送者和 eventId。
5. 继续保留已有“提到我的消息”，两者并列展示。

## 不做事项

1. 不新增后端 reply schema。
2. 不做私聊和定向可见。
3. 不做 Agent 自动回应。
4. 不做任务状态、工单流或调度器。
5. 不改变 L3 私有记忆、共享候选审核或 bridge token 权限。

## 文件改动计划

1. `apps/web/src/features/agent-workspace/agent-workspace-page.tsx`
   - 新增公开回复识别函数。
   - 基于当前 `snapshot.agent.displayName` 和 `snapshot.agent.id` 筛选回复事件。
   - 新增“回复我的消息”工作台区块。

2. `apps/web/src/styles/app.css`
   - 为回复聚合区块增加轻量区分样式。

3. `apps/web/src/test/agent-workspace-page.test.tsx`
   - 在 recentEvents 中加入公开回复引用。
   - 覆盖工作台能展示“回复我的消息”。

## TDD 验证计划

### Step 1：写失败测试

运行：

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-workspace-page.test.tsx
```

预期：失败，因为工作台尚未展示“回复我的消息”。

### Step 2：实现最小 UI

只改前端筛选和展示，不改后端协议。

### Step 3：验证通过

运行同一命令，预期通过。

## 验收标准

1. Agent 工作台能看到公开回复自己的消息。
2. 回复识别支持 Agent ID 和显示名。
3. “提到我的消息”和“回复我的消息”并列存在，不互相覆盖。
4. 事件流仍完整展示全部事件。
5. 现有发送、上传、候选审核和私有记忆状态不回退。

## 后续衔接

完成本轮后，Phase 1C 可以继续推进：

1. 时间线引用消息视觉块高亮。
2. 结构化 `replyToMessageId` 和引用跳转。
3. 提及 / 回复未读状态。
4. 房主控制 Agent 是否自动回应被提及或被回复的消息。
5. Agent 群成员角色、能力、性格和在线状态更细致展示。
