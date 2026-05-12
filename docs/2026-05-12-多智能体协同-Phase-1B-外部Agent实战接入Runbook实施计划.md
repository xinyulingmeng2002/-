# 多智能体协同 Phase 1B 外部 Agent 实战接入 Runbook 实施计划

日期：2026-05-12

## 所属阶段

Phase 1B 后续收口：Agent 邀请钥匙、Bridge 监听、真实 CLI smoke、Bridge session 可观测性已经具备后，补齐“房主如何实际把外部 Agent 接进房间并长期运行”的使用路径。

## 主线目标

保持项目方向为通用多 Agent 协同平台：任意符合 bridge 边界的外部 Agent 可以凭房间邀请钥匙进入指定房间，房主可以观察连接、诊断状态并执行断连/撤销。

本轮目标不是新增协议能力，而是把已经完成的能力收口成可实战执行的入口。

## 当前上下文

已具备能力：

1. `POST /api/bridge-tokens` 返回一次性 `multi-agent-room-invite`。
2. Codex/OpenClaw/Generic adapter 支持 `--invite-file`。
3. adapter 支持 `events pull/watch`、cursor 持久化、短暂失败 backoff、session 失效自动重连。
4. `GET /api/bridge-sessions` 已展示 `health` 和 adapter `diagnostics`。
5. `npm run smoke:phase1b` 和 `npm run smoke:phase1b:cli` 已覆盖服务端闭环和真实 Generic CLI 链路。

当前缺口：

1. 前端 `接入令牌` 面板只说“复制 JSON 给外部 AI/Agent”，没有给出下一步实操命令。
2. README 和 adapter README 分散，缺一个房主视角 runbook。
3. 首次试用时，用户不容易知道“保存 invite.json -> 启动 adapter -> watch -> 看诊断 -> 停止/撤销”的完整路径。

## 本轮范围

1. 前端 `接入令牌` 面板增加实战接入步骤。
2. 生成邀请钥匙后展示 adapter 启动、监听、停止命令提示。
3. 新增外部 Agent 实战接入 Runbook 文档。
4. README 与 Phase 1B 验收清单链接到 Runbook。
5. 用现有前端测试覆盖新增提示，避免后续回归。

## 不做事项

1. 不新增后端 API。
2. 不新增新的 adapter 类型。
3. 不做 daemon / supervisor / systemd / pm2 守护。
4. 不改变 token 明文只展示一次的安全边界。
5. 不把外部 Agent 私有上下文或私有记忆原文暴露到公共面板。

## 文件改动计划

1. `apps/web/src/features/agents/token-manager.tsx`
   - 在表单下方增加“实战接入步骤”静态提示。
   - 在 `Agent 邀请钥匙` 卡片中增加基于 `bridgeKind` 的 adapter 命令。
   - 保留现有 invite JSON 展示。

2. `apps/web/src/test/agent-panel.test.tsx`
   - 增加断言：能看到“保存为 invite.json”、“启动 adapter”、“events watch”、“查看桥接会话诊断”、“session stop”。

3. `docs/2026-05-12-多智能体协同-外部Agent实战接入Runbook.md`
   - 新增房主视角 runbook。
   - 覆盖创建邀请钥匙、交给外部 Agent、CLI adapter 启动、持续监听、诊断观察、停止、撤销、排错。

4. `README.md`
   - 在 Bridge 接入流程中指向 Runbook。

5. `docs/2026-05-12-多智能体协同-Phase-1B实战验收清单.md`
   - 把“实战接入 Runbook 与前端提示”加入已覆盖能力。

## TDD 验证计划

### Step 1：写失败测试

修改：

```text
apps/web/src/test/agent-panel.test.tsx
```

增加断言：

```text
保存为 invite.json
启动 adapter
events watch
查看桥接会话诊断
session stop
```

运行：

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-panel.test.tsx
```

预期：失败，因为 UI 尚未展示这些实战提示。

### Step 2：实现前端提示

修改：

```text
apps/web/src/features/agents/token-manager.tsx
```

实现策略：

1. 根据 `bridgeKind` 生成 workspace 名：
   - `codex` -> `@ma/bridge-codex`
   - `openclaw` -> `@ma/bridge-openclaw`
   - `generic` -> `@ma/bridge-generic`
2. 展示启动命令：
   - `session start --invite-file ./invite.json ...`
3. 展示持续监听命令：
   - `events watch --poll-ms 2000 --limit 20`
4. 展示停止命令：
   - `session stop`
5. 明确提示房主在 `桥接会话` 卡片查看 health / diagnostics。

### Step 3：写 Runbook

新增：

```text
docs/2026-05-12-多智能体协同-外部Agent实战接入Runbook.md
```

结构：

1. 适用对象
2. 快速路径
3. Web 创建邀请钥匙
4. 外部 Agent 如何使用邀请钥匙
5. CLI adapter 启动示例
6. 长时间监听和发言
7. 房主如何观察诊断
8. 停止、撤销和强制断连
9. 常见故障排查
10. 与 Phase 1B 验收命令的关系

### Step 4：更新入口文档

修改：

```text
README.md
docs/2026-05-12-多智能体协同-Phase-1B实战验收清单.md
```

只增加链接和结论，不重复大段命令。

## 验收标准

1. 前端创建邀请钥匙后，用户能在页面直接看到 adapter 启动、监听、停止命令。
2. Runbook 能从零解释房主如何把外部 Agent 接入房间。
3. README 能指向 Runbook。
4. Phase 1B 验收清单记录该能力。
5. 相关测试与 smoke 通过：

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-panel.test.tsx apps/web/src/test/room-shell.test.tsx
npm --workspace @ma/web run typecheck
npm run smoke:phase1b
npm run smoke:phase1b:cli
```

## 风险与回退

风险：

1. 页面提示过多，挤压右侧面板。
2. 命令和 adapter CLI 后续变动后文档过期。

控制：

1. 前端只展示最短实战路径，详细解释放 Runbook。
2. README 只链接 Runbook，减少重复文档。
3. 测试只锁关键文案，不锁完整命令格式，避免小改动导致脆弱测试。

回退：

1. 若 UI 提示影响体验，可保留 Runbook，仅回退 `TokenManager` 展示。
2. 不涉及数据结构迁移和后端协议，回退成本低。

## 后续衔接

本轮完成后，Phase 1B 的“能接入、能监听、能诊断、能照着文档实跑”闭环更完整。

下一阶段可以进入 Phase 1C：

1. 多 Agent 协同任务分派。
2. Agent 能力声明和房间内角色分工。
3. 房主对多 Agent 的协作编排。
4. 共享知识沉淀质量提升。
