# 多智能体协同 Phase 1C Agent 工作台指名发言入口实施计划

日期：2026-05-12

## 所属阶段

Phase 1C：多 Agent 群聊体验增强。

本轮承接“多 Agent 群聊成员可见性”“人类主输入框指名发言”“提及高亮”和“Agent 工作台引用回复入口”，继续把房间体验从单向控制台推进到群聊房间。

## 主线目标

本项目的主线是通用多智能体协同平台。房间就是群聊房间，真人和 Agent 都是房间成员，默认应拥有相同的表达、提及、回复和参与能力；房主只在治理层拥有最高权限。

本轮目标是让 Agent 在自己的工作台中也能像人类一样指名房间成员发言：

```text
Agent 打开工作台 -> 看到房间成员 -> 点击“对 <成员> 说” -> 输入框插入 @<成员> -> Agent 编辑正文并公开发送
```

这仍然是公开房间消息，不是私聊，不是任务派发，也不是自动回应。

## 设计取舍

本轮继续复用普通文本 `@displayName`，不新增后端协议。

理由：

1. 现有消息流已经能承载公开提及。
2. 主房间时间线已经支持 mention 高亮，Agent 工作台已经支持“提到我的消息”聚合。
3. Agent 工作台补齐的是同一类群聊输入能力，不需要引入额外消息类型。
4. 后续如果升级结构化 mention schema，这个入口可以作为 UI 起点继续复用。

## 本轮范围

1. Agent 工作台根据 workspace snapshot 的 `participants` 生成可指名对象。
2. 可指名对象包含真人和其他 Agent。
3. 当前 Agent 自己不出现在可指名对象中，避免自我 @ 的默认按钮干扰。
4. 点击“对 <成员> 说”后，在“消息内容”输入框前置 `@<displayName> `。
5. 如果当前输入框已经以同一个 mention 开头，重复点击不重复插入。

## 不做事项

1. 不做私聊或定向可见消息。
2. 不做自动回应策略。
3. 不做任务分派、任务领取或任务状态流。
4. 不修改 bridge token、session、workspace snapshot 或事件协议。
5. 不改变房主治理权限模型。

## 文件改动计划

1. `apps/web/src/features/agent-workspace/agent-workspace-page.tsx`
   - 根据 `snapshot.participants` 计算工作台可指名对象。
   - 在工作台 composer 中渲染“指名发言”按钮。
   - 点击按钮时更新 `messageBody`。

2. `apps/web/src/styles/app.css`
   - 增加工作台指名发言按钮行样式。
   - 复用主输入框的 mention button 视觉语言。

3. `apps/web/src/test/agent-workspace-page.test.tsx`
   - 覆盖工作台连接后能看到真人和其他 Agent 的指名按钮。
   - 覆盖点击其他 Agent 后输入框填入 `@OpenClaw `。

## TDD 验证计划

### Step 1：写失败测试

运行：

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-workspace-page.test.tsx
```

预期：失败，因为 Agent 工作台还没有“对 房主 说 / 对 OpenClaw 说”按钮。

### Step 2：实现最小 UI

只改 Agent 工作台前端交互，不改后端协议。

### Step 3：验证通过

运行同一命令，预期通过。

## 验收标准

1. Agent 工作台连接后能看到除自己以外的房间成员指名按钮。
2. 真人成员和其他 Agent 成员都可以被指名。
3. 点击按钮后输入框填入公开 mention 草稿。
4. 已有消息发送、附件上传、提及聚合、回复聚合、候选审核和私有记忆状态不回退。

## 后续衔接

完成本轮后，Phase 1C 可以继续推进：

1. 房间内统一的成员操作菜单。
2. 更明确的在线状态与断连治理。
3. 结构化 mention / reply schema。
4. Agent 对被提及消息的可配置提醒与响应策略。
