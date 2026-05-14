# 多智能体协同 Phase 1C 收束与 Phase 1D 入口评估

日期：2026-05-14

## 结论

Phase 1C 已经进入收束期。

当前不建议继续无限追加群聊 UI 小功能。更合理的节奏是：

```text
Phase 1C 剩余：最终验收 + 实战长跑 + 状态文档收束
Phase 1D 入口：真实长期运行、可观测性、接入稳定性、试用门槛降低
```

如果后续 1-2 个小切片完成最终验收，项目即可正式进入 Phase 1D。

## 阶段定位

### Phase 1A

已完成：基础协作台底座。

包括空间、房间、消息、附件、事件日志、前端时间线、参与者、基础 bridge、记忆分层和候选审核。

### Phase 1B

已完成：外部 Agent 最小实战接入闭环。

包括邀请钥匙、token/session、join room、heartbeat、message、attachment、events pull、workspace snapshot、adapter CLI、smoke、Runbook 和房主断连。

### Phase 1C

当前状态：核心能力已完成，进入收束验收。

已完成的核心方向：

1. 多 Agent / 真人成员可见。
2. 群聊式指名发言。
3. 公开回复与引用块。
4. Agent 工作台提到我 / 回复我聚合。
5. 成员状态与成员卡工作台入口。
6. adapter `events watch` 重点事件输出。
7. adapter transcript 输出。
8. 房主实战向导增强。
9. 结构化 `mentions` / `replyToMessageId` 兼容字段。
10. Agent 工作台与 bridge ingress 透传结构化 mention / reply。
11. adapter attentionTags 优先使用结构化字段，文本规则作为 fallback。

## Phase 1C 剩余缺口

### P0：最终验收口径

还需要把 Phase 1C 的完成标准固化为一份可重复执行的验收清单。

验收应覆盖：

1. 主房间人类群聊操作。
2. Agent 工作台群聊操作。
3. bridge ingress / egress。
4. 三套 adapter 的 watch / transcript / attentionTags。
5. 结构化 mention / reply 字段。
6. 文件附件仍可上传、查看、预览。
7. L3 私有记忆仍不旁路公开。

### P0：真实接入长跑验证

当前测试覆盖已经较完整，但还缺一次面向“真实使用”的长跑脚本或手工验收记录。

建议至少验证：

1. 创建房间与邀请钥匙。
2. 启动 Generic adapter 或 Codex adapter。
3. Agent 发送消息。
4. 人类提及 Agent。
5. Agent watch 输出 `mentioned-you`。
6. 人类回复 Agent。
7. Agent watch 输出 `reply-to-you`。
8. 附件消息仍能进入时间线。
9. session 停止、房主断连或 token 撤销路径可用。

### P1：README 与阶段入口更新

README 当前已经记录 Phase 1C 正在进行，但仍带有“下一阶段优先级：继续增强 adapter watch”的旧口径。该项已经完成，应更新为：

```text
Phase 1C 核心能力已完成，当前处于最终验收与 1D 入口准备期。
```

### P1：成员动作区最终收束

成员卡已有“对 TA 说”和“工作台”。治理动作仍主要在 bridge/token 面板里，当前没有主线阻塞。

是否继续做成员菜单，不应作为 1D 入口阻塞。它可以留到 1D 或 Phase 2 的产品化体验中。

### P2：跨批次 replyToMessageId 识别

adapter 当前只在同一 watch batch 内用 `replyToMessageId` 对照原消息。

这不是 1D 入口阻塞。跨批次索引会增加本地状态复杂度，建议放到 Phase 1D 的“长期运行可观测性与稳定提醒”里处理。

## Phase 1D 进入条件

满足以下条件即可正式进入 Phase 1D：

1. 新增并通过 `Phase 1C` 最终验收清单。
2. 至少完成一次真实接入长跑记录。
3. README 与阶段文档更新到“1C 收束 / 1D 准备”口径。
4. 当前工作树干净，`main` 同步 `origin/main`。
5. 不再有 Phase 1C 主线级阻塞缺口。

## Phase 1D 推荐主题

Phase 1D 不应继续扩散为普通 UI 打磨。推荐命名：

```text
Phase 1D：真实长期运行与接入稳定性
```

核心目标：

1. 让外部 Agent 不只是能进房间，而是能稳定长期在线。
2. 让房主知道 Agent 是否仍在监听、失败在哪里、是否需要处理。
3. 降低用户从“创建钥匙”到“Agent 真正入房群聊”的试用成本。
4. 为后续多 Agent 编排、插件化 adapter 和更复杂记忆能力打运维基础。

建议 1D 优先级：

### 1D-P0：Phase 1C 最终验收清单与 smoke

先把 1C 完成状态锁住，避免后续阶段回归。

### 1D-P1：真实 adapter 长跑可观测性

增强 session 健康、watch cursor、最近错误、连续失败、重连记录和房主可读提示。

### 1D-P2：接入向导产品化

把“保存 invite -> 启动 adapter -> watch -> 检查在线 -> 停止 / 撤销”进一步做成更不容易误操作的房主路径。

### 1D-P3：adapter 本地状态增强

考虑跨批次 `replyToMessageId` 索引、watch 输出过滤、重点事件摘要和 transcript 可读性增强。

## 当前下一步

下一步应先做：

```text
Phase 1C 最终验收清单与验收脚本规划
```

原因：

1. 它是进入 Phase 1D 的硬门槛。
2. 它能防止后续继续追加功能时破坏已经完成的 1C 群聊能力。
3. 它比继续做成员菜单、跨批次 reply 索引更靠近阶段收束目标。

## 主线偏移检测

当前没有主线级偏移。

依据：

1. 最新提交仍围绕房间群聊、Agent 接入、提及、回复、重点事件与结构化字段。
2. 没有把平台改成任务派发工具。
3. 没有把 OpenClaw/Codex 写成平台边界。
4. 没有把秋灵小窝、Telegram 或其他外部系统写入核心依赖。
5. 私有记忆边界仍保持候选审核路径。

需要继续警惕：

1. 不要把 1D 做成“继续抠 UI”。
2. 不要过早做复杂自动回应或自治编排。
3. 不要为了示范 adapter 牺牲任意 Agent 可接入的统一边界。
4. 不要跳过长跑验收直接宣称可长期实战。
