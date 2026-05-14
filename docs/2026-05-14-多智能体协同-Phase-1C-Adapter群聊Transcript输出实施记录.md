# 多智能体协同 Phase 1C Adapter 群聊 Transcript 输出实施记录

日期：2026-05-14

## 背景

上一轮已经让 `events watch` 对“提到我 / 回复我”的重点群聊事件增加 `attentionTags`。但默认 JSON 行输出更适合程序，不适合外部网页 AI、CLI Agent 或人工直接粘贴进上下文。

本轮继续沿 Phase 1C 主线推进：让被房间钥匙邀请进来的外部 Agent 更稳定地读懂群聊现场。

## 目标

为三套 adapter 的 `events watch` 增加可选输出格式：

```bash
--format transcript
```

默认格式保持 JSON，不破坏已有脚本和自动化调用。

## 输出形态

Transcript 输出以可读群聊片段为目标：

```text
### Room Events
- [mentioned-you] 2026-05-14T04:30:00.000Z 人类 (human-1): @Codex 你怎么看？
- [reply-to-you] agent-openclaw: > 回复 Codex: 上一句 / 我补充一下。
nextCursor: evt-3
```

它仍然保留 `attentionTags`、说话者、正文和 cursor 这些 Agent 接入需要的关键信息。

## 设计取舍

1. 默认仍为 JSON，保证机器可读和向后兼容。
2. transcript 只改变 CLI 输出，不改变服务端协议、不改变事件结构、不改变 cursor。
3. formatter 放在 `@ma/bridge-shared`，避免三套 adapter 复制同一套文本规则。
4. 本轮不做自动总结、不做自动回应、不做任务分派。

## 改动范围

1. `apps/bridges/shared/src/watch-format.ts`
   - 新增 `formatWatchBatchAsTranscript`。

2. `apps/bridges/*/src/config.ts`
   - `events watch` 支持 `--format json|transcript`。

3. `apps/bridges/*/src/cli.ts`
   - 根据 `outputFormat` 选择 JSON 行输出或 transcript 输出。

4. `apps/bridges/*/README.md`
   - 记录 transcript 用法。

## 验收标准

1. 未传 `--format` 时默认 `json`。
2. 传 `--format transcript` 时输出适合外部 Agent 阅读的群聊片段。
3. `attentionTags` 在 transcript 中可见。
4. 三套 adapter 行为一致。
5. 不影响上一轮 runtime watch、cursor、backoff、重连逻辑。

## 验证命令

```bash
npm --workspace @ma/bridge-shared test -- --run apps/bridges/shared/test/watch-format.test.ts
npm --workspace @ma/bridge-codex test -- --run apps/bridges/codex/test/config.test.ts
npm --workspace @ma/bridge-openclaw test -- --run apps/bridges/openclaw/test/config.test.ts
npm --workspace @ma/bridge-generic test -- --run apps/bridges/generic/test/config.test.ts
npm --workspace @ma/bridge-shared run typecheck
npm --workspace @ma/bridge-codex run typecheck
npm --workspace @ma/bridge-openclaw run typecheck
npm --workspace @ma/bridge-generic run typecheck
git diff --check
```
