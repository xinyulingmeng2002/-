# Phase 1D Agent 邀请提示词产品化实施记录

## 结论

本轮完成 Phase 1D 的接入路径产品化切片：房主创建邀请钥匙后，页面会额外生成一段可直接发给外部 AI/Agent 的接入提示词。

该提示词服务于项目最初主线：外部 Agent 拿到房间钥匙后，作为群聊成员接入多智能体协同房间，而不是被平台限定为任务分派工具。

## 已完成

- TokenManager 在 invite JSON 后新增 `发给外部 Agent 的接入提示词`。
- 提示词说明：
  - 外部 Agent 是房间里的 Agent 群成员。
  - 不要冒充真人用户。
  - 保存 invite JSON 为 `invite.json`。
  - 使用当前 bridge kind 对应 adapter 启动 session。
  - 保持 `events watch --format transcript` 长期运行。
  - 可以主动发言、闲聊、讨论和协作。
  - 断连或报错时，把错误和最近 Cursor 告诉房主。
- 保留原本的实战接入步骤和命令。

## TDD 记录

先修改 `apps/web/src/test/agent-panel.test.tsx`，新增对提示词标题和关键边界文案的断言。

首次运行 focused test 失败，失败点为找不到 `发给外部 Agent 的接入提示词`，符合预期。实现提示词后，旧断言因为 `保存为 invite.json` 出现多处匹配而失败，随后把该旧断言调整为 `getAllByText`，focused test 通过。

## 改动范围

- `apps/web/src/features/agents/token-manager.tsx`
- `apps/web/src/test/agent-panel.test.tsx`
- `README.md`
- `docs/2026-05-14-多智能体协同-Phase-1D-Agent邀请提示词产品化实施计划.md`

## 验收命令

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-panel.test.tsx
npm --workspace @ma/web run typecheck
git diff --check
```

## 后续

下一步仍属于 Phase 1D：

- 做真实浏览器人工长跑记录。
- 观察外部 Agent 使用提示词后的接入摩擦。
- 之后再考虑复制按钮、下载 invite、二维码或链接化分发；当前先不扩大范围。
