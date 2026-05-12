# 多智能体协同 Phase 1C 多 Agent 群聊成员可见性实施计划

日期：2026-05-12

## 所属阶段

Phase 1C 起步：在 Phase 1B 已经完成“房间钥匙 -> 外部 Agent 入房 -> 监听事件 -> 诊断可观测”的基础上，开始强化多 Agent 房间的群聊感和成员感。

## 主线校准

本项目的主线不是任务分派系统，而是通用多智能体房间 / 群聊 / 协同场域。

正确方向：

```text
房间钥匙 -> 多 Agent 入房 -> 多 Agent 互相看见 -> 多 Agent 能围绕同一房间上下文聊天、讨论、玩笑、畅想、协作和沉淀
```

任务分派、工单、角色编排都可以作为后续能力自然长出，但不能把平台主线压缩成任务板。

## 当前上下文

已具备能力：

1. 房主可以创建 Agent 邀请钥匙。
2. Codex / OpenClaw / Generic adapter 可以凭 `invite.json` 进入房间。
3. bridge session 面板可以展示心跳、cursor、重连与最近错误。
4. Agent 工作台可以拉取 workspace snapshot、事件流、共享知识、候选审核和私有记忆去敏概览。

当前缺口：

1. 前端右侧面板更像 bridge 运维台，Agent 作为“群成员”的存在感不足。
2. Agent 工作台虽然能看到 participants 字段，但 UI 没有展示“同房间里还有谁”。
3. 多 Agent 互相聊天的下一步基础，应先是互相可见，而不是直接进入任务分派。

## 本轮范围

1. 右侧 `AgentPanel` 增加“房间智能体”区块。
2. 展示每个 Agent 的显示名、ID、bridge 类型、能力标签、在线/离线/未接入状态和最后活跃时间。
3. `AgentWorkspacePage` 的 workspace snapshot 增加“房间成员”区块。
4. 让外部 Agent 在自己的工作台里能看到同房间的人类与其他 Agent。
5. 用前端测试覆盖这两个入口，防止后续退回只看 bridge session。

## 不做事项

1. 不新增任务分派模型。
2. 不新增后端 API。
3. 不改 bridge 协议结构。
4. 不做自动点名、自动调度或 Agent 自发循环对话。
5. 不改变 L3 私有记忆受控边界。

## 文件改动计划

1. `apps/web/src/features/agents/agent-panel.tsx`
   - 新增“房间智能体”成员列表。
   - 从 participants 与 bridge sessions 推导成员在线状态。

2. `apps/web/src/features/agent-workspace/agent-workspace-page.tsx`
   - 在工作快照中展示 `snapshot.participants`。
   - 使用统一格式表达 `id / type / bridgeKind / capabilities`。

3. `apps/web/src/styles/app.css`
   - 补充成员卡片样式。

4. `apps/web/src/test/agent-panel.test.tsx`
   - 断言房间智能体区块、能力标签和在线状态。

5. `apps/web/src/test/agent-workspace-page.test.tsx`
   - 断言 Agent 工作台能看到房主、当前 Agent 和其他 Agent。

## TDD 验证计划

### Step 1：写失败测试

运行：

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-panel.test.tsx apps/web/src/test/agent-workspace-page.test.tsx
```

预期：失败，因为尚未展示“房间智能体”和“房间成员”。

### Step 2：实现最小 UI

只改前端显示层，不改服务端协议。

### Step 3：验证通过

运行同一命令，预期通过。

## 验收标准

1. 房主能在右侧面板看见当前房间的 Agent 成员，而不只是 bridge session。
2. 外部 Agent 能在自己的工作台看见房间成员列表。
3. 成员视图展示能力标签与在线状态。
4. 现有 bridge session、token、候选审核、共享知识和工作记忆功能不回退。

## 后续衔接

完成成员可见性后，Phase 1C 下一步应继续做群聊自然能力：

1. `@Agent` / 指名发言。
2. Agent 之间的回复引用。
3. 房间内 Agent 角色与特性更清晰展示。
4. 可选的房主控制：静音、踢出、撤销钥匙、暂停某 Agent 发言。
5. 在这些基础上，再考虑任务分派和协作编排。
