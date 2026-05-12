# 多智能体协同 Phase 1C 成员卡 Agent 工作台入口实施计划

日期：2026-05-12

## 所属阶段

Phase 1C：多 Agent 群聊体验增强。

本轮承接“成员列表指名操作入口”和“成员列表统一状态展示”，继续把成员卡片推进为统一成员操作区。

## 主线目标

本项目的房间是群聊房间，真人和 Agent 都是成员。成员卡片应优先服务群聊体验，同时为可连接的 Agent 提供明确工作入口。

本轮目标是在成员卡里为在线且已建立 bridge session 的 Agent 增加“工作台”入口：

```text
看到在线 Agent -> 点击成员卡“工作台” -> 打开该 Agent 的 workspace
```

这不是任务派发，不是私聊，也不是强制 Agent 回应。它只是把已经存在的 Agent 工作台入口放回成员上下文里，减少用户在成员列表和桥接会话列表之间来回寻找。

## 设计取舍

本轮只接入“打开工作台”，不迁移强制断连、撤销 token 等治理动作。

理由：

1. “打开工作台”是低风险导航动作，适合先进入成员卡。
2. 强制断连和 token 撤销属于房主管理动作，后续需要更清晰的治理分层，不能和普通群聊动作混在一起。
3. 当前已有 `onOpenAgentWorkspace` 回调和 session 信息，可以前端复用，不需要新增后端协议。

## 本轮范围

1. `ParticipantViewModel` 增加可选 `workspaceSessionId`。
2. `RoomShell` 从 connected bridge session 推导成员对应的工作台 session。
3. `ParticipantList` 对有 `workspaceSessionId` 的 Agent 显示“工作台”按钮。
4. 点击成员卡工作台按钮时调用既有 `onOpenAgentWorkspace`。

## 不做事项

1. 不做强制断连入口迁移。
2. 不做 token 撤销入口迁移。
3. 不做成员详情弹窗。
4. 不做自动回应或任务派发。
5. 不做后端协议调整。

## 文件改动计划

1. `apps/web/src/features/participants/participant-list.tsx`
   - 支持成员卡工作台操作回调。
   - 仅对有关联 workspace session 的 Agent 渲染工作台按钮。

2. `apps/web/src/features/rooms/room-shell.tsx`
   - 增加 workspace session 推导。
   - 将成员卡工作台操作接到既有 `onOpenAgentWorkspace`。

3. `apps/web/src/styles/app.css`
   - 调整成员卡操作区样式。

4. `apps/web/src/test/room-shell.test.tsx`
   - 覆盖从成员卡打开在线 Agent 工作台。

## TDD 验证计划

### Step 1：写失败测试

运行：

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/room-shell.test.tsx
```

预期：失败，因为成员卡还没有“从成员列表打开 实时助手 工作台”按钮。

### Step 2：实现最小 UI

只改前端视图模型和按钮回调，不改后端协议。

### Step 3：验证通过

运行同一命令，预期通过。

## 验收标准

1. 在线且有 connected bridge session 的 Agent 成员卡显示工作台入口。
2. 点击成员卡工作台入口会打开对应 Agent workspace。
3. 离线或未接入 Agent 不显示成员卡工作台入口。
4. 成员指名发言、主输入框、桥接会话工作台入口、候选审核和 Agent 工作台不回退。

## 后续衔接

完成本轮后，Phase 1C 可以继续推进：

1. 成员卡治理动作分层，例如断连、撤销 token、禁言等。
2. 成员详情弹层，聚合能力标签、在线状态、最近心跳和工作台入口。
3. 群聊动作和房主管理动作视觉分区，避免把成员当成任务工具。
