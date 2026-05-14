# Phase 1D Agent 邀请复制动作实施记录

## 结论

本轮完成 Phase 1D 的接入路径降摩擦切片：房主创建邀请钥匙后，可以一键复制 invite JSON 和外部 Agent 接入提示词。

这仍然服务于通用多智能体群聊主线：房主更容易把“房间钥匙”和“入房说明”交给任意正在运行上下文的外部 Agent。

## 已完成

- `Agent 邀请钥匙` 区域新增 `复制邀请 JSON`。
- `发给外部 Agent 的接入提示词` 区域新增 `复制接入提示词`。
- 复制成功时显示：
  - `已复制邀请 JSON`
  - `已复制接入提示词`
- 浏览器剪贴板写入失败时显示：
  - `复制失败，请手动复制`

## TDD 记录

先在 `apps/web/src/test/agent-panel.test.tsx` 中 mock `navigator.clipboard.writeText`，再新增复制按钮断言。

首次运行 focused test 失败，失败点为找不到 `复制邀请 JSON`，符合预期。实现复制按钮和反馈后 focused test 通过。随后补充 clipboard 拒绝写入的失败反馈断言，focused test 继续通过。

## 改动范围

- `apps/web/src/features/agents/token-manager.tsx`
- `apps/web/src/styles/app.css`
- `apps/web/src/test/agent-panel.test.tsx`
- `README.md`

## 验收命令

```bash
npm --workspace @ma/web test -- --run apps/web/src/test/agent-panel.test.tsx
npm --workspace @ma/web run typecheck
git diff --check
```

## 后续

下一步可以继续 Phase 1D：

- 做真实浏览器人工长跑记录。
- 若实战仍有摩擦，再考虑下载 `invite.json`、二维码或外链分发。
- 暂不扩大到复杂 token 管理或告警系统。
