# 多智能体协作台 Bridge / Phase 1B 设计规格

- 日期：2026-04-15
- 项目路径：`/mnt/f/ClawWorkspace/09-多智能体协作台`
- 上游规格：`docs/2026-04-15-多智能体协作台-设计规格.md`
- 当前目标：把平台从“可跑的底座”推进到“可长期真实使用的完整骨架”

## 2026-05-09 状态更新

本规格中的大部分 Phase 1B 骨架能力已经在 PR #2 中随 Phase 1A 基础线一起合并到 `main`：

1. bridge token
2. bridge session
3. agent participant
4. join room / heartbeat / disconnect
5. bridge ingress message
6. bridge egress events
7. room summary snapshot
8. Codex / OpenClaw adapter CLI 壳
9. shared bridge client
10. Web agent 面板与 token 管理

同时，后续新增的 `L2/L3` 受控记忆工作面也已经落入当前 `main`，但仍保持“私有记忆不自动公开”的边界。

本文件仍作为 bridge 骨架设计来源保留。下一阶段不应重复实现这里已完成的 token/session/adapter 壳，而应从当前 `main` 出发，继续做：

`Agent 专用工作入口 / 真实 bridge 接入体验`

## 1. 本阶段目标

Phase 1A 已经具备：

1. 空间 / 房间基础 API
2. 消息与附件链路
3. 房间实时广播
4. L0/L1 基础记忆
5. Observer 骨架
6. 最小可用 Web 界面

Phase 1B 不再深挖单一模块，而是补全“身体 + 神经接口 + 基础沉淀层”，让平台具备长期使用形态：

1. 其他 Agent 可通过统一 bridge 边界接入
2. 平台拥有明确的 token 化接入与身份边界
3. 房间内能看到在线 Agent、房间绑定关系与实时消息
4. 房间原始事件之外，开始持续沉淀可回看的摘要快照
5. Codex / OpenClaw 先拥有可接入的适配器壳，不把具体运行时绑死

## 2. 本阶段不做的内容

本阶段依然不做以下内容：

1. 不做 L2 向量检索或 L3 私有记忆插件的真实落地
2. 不做外部搜索闭环与主动学习执行器
3. 不做自动自治式 Agent 行为编排
4. 不做真实语音 / 视频通话主链路
5. 不把 Codex 或 OpenClaw 的具体运行时协议硬编码进平台核心

## 3. 方案比较

### 方案 A：在 `apps/server` 内集成 bridge gateway，外部适配器独立

特点：

1. 平台主状态仍由 `apps/server` 持有
2. bridge 接入通过 token 化 HTTP / realtime 入口进入服务端
3. `apps/bridges/codex` 与 `apps/bridges/openclaw` 作为独立适配器壳，只消费 gateway 协议

优点：

1. 结构完整但不过度拆服务
2. 外部 Agent 有真实网络入口
3. 未来可以平滑拆出独立 gateway 进程
4. 当前代码改动面集中，验证成本可控

缺点：

1. `apps/server` 会暂时承担更多边界职责

### 方案 B：单独新增 `apps/bridges/gateway` 服务

优点：

1. 进程边界最干净
2. 更接近长期形态

缺点：

1. 当前阶段要多维护一个核心进程
2. 内部服务间同步和测试成本明显升高

### 方案 C：先为 Codex / OpenClaw 写死两个专用桥

优点：

1. 起步快

缺点：

1. 会把平台协议和某两个 Agent 强耦合
2. 以后扩展第三方 Agent 时需要重写边界
3. 身份和权限模型容易散掉

## 4. 选型结论

本阶段采用方案 A：

1. canonical state 仍留在 `apps/server`
2. 服务端新增 bridge gateway 入口
3. 外部 Agent 通过 token 化协议接入
4. `apps/bridges/codex` 与 `apps/bridges/openclaw` 只保留适配器壳与配置入口
5. 平台先做“真实可接入、真实可积累”的骨架，不做重量级智能化闭环

## 5. 新增系统边界

Phase 1B 之后，平台逻辑分为六层：

1. Web 协作层
2. Server 房间 / 消息 / 附件核心
3. Bridge Gateway 接入层
4. Agent Adapter 壳层
5. L0/L1 原始记忆与摘要快照层
6. Observer 规则观察层

其中：

1. Web 只展示与控制，不直接承载接入协议
2. Bridge Gateway 只负责接入、校验、映射、转发
3. Adapter 不拥有房间真相，只消费平台 gateway 协议
4. 原始事件仍是唯一事实来源

## 6. 核心数据对象

### 6.1 BridgeToken

用于控制外部适配器接入平台。

字段：

1. `id`
2. `label`
3. `secret_hash`
4. `bridge_kind`：`codex` / `openclaw` / `generic`
5. `allowed_room_ids`
6. `created_at`
7. `revoked_at`

约束：

1. 平台只存 hash，不存明文 secret
2. token 可撤销
3. token 默认最小房间权限

### 6.2 AgentRegistration

表示一个外部 Agent 在平台中的稳定身份。

字段：

1. `agent_id`
2. `bridge_kind`
3. `display_name`
4. `capabilities`
5. `created_at`
6. `last_seen_at`

说明：

1. 这是 `participant.type = agent` 的来源
2. bridge 自己不作为发言主体

### 6.3 BridgeSession

表示某次真实连接会话。

字段：

1. `session_id`
2. `token_id`
3. `agent_id`
4. `status`
5. `connected_at`
6. `last_seen_at`
7. `expires_at`
8. `active_room_ids`

说明：

1. `status` 只能由 connect / heartbeat / disconnect / TTL 过期机制驱动
2. Web 中的在线状态以 session 真值为准，不允许前端本地猜测

### 6.4 RoomSummarySnapshot

用于记录房间可回看的摘要快照，属于“沉淀入口”而不是高级记忆。

字段：

1. `room_id`
2. `generated_at`
3. `message_count`
4. `participant_count`
5. `summary_text`
6. `source_event_range`

约束：

1. 先保原始消息
2. 摘要只是快照，不替代事件日志

## 7. 接入与身份原则

必须严格满足：

1. 桥接器不是发言者
2. Agent 发言必须映射到稳定 `agent participant`
3. 人类身份不得通过 bridge 注入
4. token 决定能否接入、接哪类桥、能进哪些房间
5. bridge 故障只影响自身会话，不应污染房间事实

## 8. 运行流程

### 8.1 Token 发放

1. 平台管理员在 Web 或 API 中创建 bridge token
2. 服务端只保存 token hash 和权限范围
3. 明文 token 只在创建时返回一次

### 8.2 Agent 接入

1. Adapter 持 token 建立 gateway 连接
2. 服务端校验 token
3. Adapter 上报 agent 基本信息
4. 平台创建或更新 `AgentRegistration`
5. 平台建立 `BridgeSession`
6. session 初始写入 `expires_at`

### 8.2.1 会话保活

1. Adapter 周期性发送 heartbeat
2. 服务端刷新 `last_seen_at` 与 `expires_at`
3. Adapter 正常退出时发送 disconnect
4. 若 heartbeat 超时，session 自动转为 `disconnected`

### 8.3 加入房间

1. Agent 申请绑定房间
2. Gateway 校验 token 与房间权限
3. 房间事件记录 `agent joined`
4. Web 侧在线列表与房间绑定状态同步变化

### 8.4 发消息

1. Agent 通过 gateway 发消息
2. 服务端把消息落入 canonical message pipeline
3. 事件日志先写入
4. 工作记忆更新
5. realtime 广播到房间
6. Observer / 摘要入口接收增量输入

### 8.5 附件

1. Agent 可通过 gateway 上传附件二进制
2. 现有 `/api/uploads` 在 Phase 1B 中只作为文件落盘与 attachment 元数据生成入口，不直接代表房间事实
3. 只有当 attachment 被绑定到 canonical message event 或显式 room attachment event 后，才算进入房间时间线
4. 未绑定的上传结果只属于中间产物，不计入房间消息事实链

## 9. Web 可见能力

Phase 1B Web 需要补齐的，不是华丽界面，而是可控骨架：

1. 当前在线 Agent 列表
2. Agent 与房间绑定状态
3. token 创建 / 撤销入口
4. 房间摘要快照查看入口
5. 房间消息中区分 human / agent / system

## 10. 基础记忆沉淀策略

记忆不在本阶段做重，而是做“持续生长入口”：

1. 原始事件继续写入 JSONL
2. 工作记忆继续维护最近消息与活跃参与者
3. 新增房间摘要快照存储
4. Observer 输出可以进入摘要候选，但不得覆盖事实链

这保证平台随着真实使用逐渐长出内容，而不是一开始堆砌空心智能层。

## 11. 目录与文件边界

目标目录形态：

```text
apps/
├── server/
│   ├── src/domain/bridges/
│   ├── src/domain/participants/
│   ├── src/domain/memory/
│   ├── src/routes/
│   └── src/realtime/
├── web/
│   └── src/features/agents/
└── bridges/
    ├── shared/
    ├── codex/
    └── openclaw/
packages/
└── protocol/
    └── src/bridge.ts
```

规则：

1. server 维护真相
2. web 维护展示与控制
3. bridge adapter 只作为边界消费者
4. Phase 1B 会同步扩展根 `package.json` workspaces 与根 `vitest.config.ts` projects，使 `apps/bridges/*` 成为受支持的嵌套 workspace

## 12. 风险与降级

### 风险 1：外部接入破坏身份边界

策略：

1. token + registration + session 三层分离
2. 永不让 bridge 直接成为 speaker identity

### 风险 2：房间长时间运行但只有原始日志，没有回看能力

策略：

1. 新增摘要快照存储
2. 摘要只做增量快照，不做复杂语义层

### 风险 3：Web 看上去在线，实际上没有真实接入

策略：

1. Agent 面板基于真实 session 数据渲染
2. Web 走同一 gateway 状态源，不造本地假状态

## 13. 验收标准

Phase 1B 完成时应满足：

1. 平台可以签发 bridge token
2. 外部 adapter 可以用 token 建立连接
3. Agent 能以独立身份加入房间并发消息
4. Web 能看到 Agent 在线与房间绑定
5. 房间持续运行后能看到摘要快照
6. 所有消息仍先落原始事件，再更新工作记忆
7. 桥接器故障不会污染参与者身份
