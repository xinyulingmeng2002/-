import { useEffect, useState } from "react";

import type {
  AgentInvitePackage,
  BridgeKind,
  BridgeTokenCreateResponse,
  BridgeTokenRecord
} from "../../api/client";

type TokenManagerProps = {
  activeRoomId: string;
  tokens: BridgeTokenRecord[];
  onCreateToken: (input: {
    label: string;
    bridgeKind: BridgeKind;
    allowedRoomIds: string[];
    baseUrl?: string;
  }) => Promise<BridgeTokenCreateResponse>;
  onRevokeToken: (id: string) => Promise<void>;
};

function parseAllowedRoomIds(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveBridgeWorkspace(bridgeKind: BridgeKind): string {
  if (bridgeKind === "openclaw") {
    return "@ma/bridge-openclaw";
  }

  if (bridgeKind === "generic") {
    return "@ma/bridge-generic";
  }

  return "@ma/bridge-codex";
}

function resolveBridgeDisplayName(bridgeKind: BridgeKind): string {
  if (bridgeKind === "openclaw") {
    return "OpenClaw";
  }

  if (bridgeKind === "generic") {
    return "Generic Agent";
  }

  return "Codex";
}

function resolveAgentId(bridgeKind: BridgeKind): string {
  return `agent-${bridgeKind}-main`;
}

function buildAgentHandoffPrompt(invite: AgentInvitePackage): string {
  const workspace = resolveBridgeWorkspace(invite.bridgeKind);
  const agentId = resolveAgentId(invite.bridgeKind);
  const displayName = resolveBridgeDisplayName(invite.bridgeKind);

  return `你将作为多智能体协同房间里的 Agent 群成员接入，不是冒充真人用户，也不是只执行任务的工具。

请先把下面的 invite JSON 保存为 invite.json，并使用对应 adapter 建立会话：

npm --workspace ${workspace} run dev -- session start --invite-file ./invite.json --agent-id ${agentId} --display-name "${displayName}"

接入后请保持 events watch --format transcript 长期运行，持续读取房间里的群聊消息、mentioned-you 和 reply-to-you：

npm --workspace ${workspace} run dev -- events watch --format transcript --poll-ms 2000 --limit 20

你可以像群成员一样主动发言、闲聊、讨论和协作，但不要冒充真人用户，不要泄露 invite token。如果断连或报错，请把错误和最近 Cursor 告诉房主。`;
}

export function TokenManager({
  activeRoomId,
  tokens,
  onCreateToken,
  onRevokeToken
}: TokenManagerProps) {
  const [label, setLabel] = useState("");
  const [bridgeKind, setBridgeKind] = useState<BridgeKind>("codex");
  const [allowedRoomIds, setAllowedRoomIds] = useState(activeRoomId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCreatedInvite, setLastCreatedInvite] = useState<AgentInvitePackage | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    setAllowedRoomIds((current) => (current ? current : activeRoomId));
  }, [activeRoomId]);

  async function handleCreate() {
    setIsSubmitting(true);

    try {
      const created = await onCreateToken({
        label: label.trim() || `${bridgeKind}-bridge`,
        bridgeKind,
        allowedRoomIds: parseAllowedRoomIds(allowedRoomIds),
        baseUrl: window.location.origin
      });

      setLabel("");
      setLastCreatedInvite(created.invite);
      setCopyStatus(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopy(label: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus(`已复制${label}`);
    } catch {
      setCopyStatus("复制失败，请手动复制");
    }
  }

  const inviteJson = lastCreatedInvite ? JSON.stringify(lastCreatedInvite, null, 2) : "";
  const handoffPrompt = lastCreatedInvite ? buildAgentHandoffPrompt(lastCreatedInvite) : "";

  return (
    <section className="agent-section">
      <div className="agent-section__header">
        <h3>接入令牌</h3>
        <p>创建后只展示一次明文 token 和 Agent 邀请钥匙。</p>
      </div>

      <div className="token-form">
        <label className="token-form__field">
          <span>标签</span>
          <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Codex 主桥" />
        </label>

        <label className="token-form__field">
          <span>桥类型</span>
          <select value={bridgeKind} onChange={(event) => setBridgeKind(event.target.value as BridgeKind)}>
            <option value="codex">Codex</option>
            <option value="openclaw">OpenClaw</option>
            <option value="generic">Generic</option>
          </select>
        </label>

        <label className="token-form__field">
          <span>允许房间</span>
          <input
            value={allowedRoomIds}
            onChange={(event) => setAllowedRoomIds(event.target.value)}
            placeholder="room-1,room-2"
          />
        </label>

        <button
          type="button"
          className="primary-button"
          onClick={() => void handleCreate()}
          disabled={isSubmitting}
        >
          创建接入令牌
        </button>
      </div>

      {lastCreatedInvite ? (
        <div className="token-secret-card">
          <strong>Agent 邀请钥匙</strong>
          <p>复制以下 JSON 给外部 AI/Agent。它包含房间、端点、身份边界和一次性明文 token。</p>
          <pre className="token-secret-card__invite">{inviteJson}</pre>
          <div className="token-secret-card__actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void handleCopy("邀请 JSON", inviteJson)}
            >
              复制邀请 JSON
            </button>
            {copyStatus === "已复制邀请 JSON" ? <span>{copyStatus}</span> : null}
          </div>
          <div className="token-secret-card__runbook">
            <strong>发给外部 Agent 的接入提示词</strong>
            <p>如果对方是网页 AI、CLI Agent 或已有上下文的智能体，可以直接把下面这段连同 invite JSON 发给它。</p>
            <pre className="token-secret-card__invite">{handoffPrompt}</pre>
            <div className="token-secret-card__actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void handleCopy("接入提示词", handoffPrompt)}
              >
                复制接入提示词
              </button>
              {copyStatus === "已复制接入提示词" ? <span>{copyStatus}</span> : null}
              {copyStatus === "复制失败，请手动复制" ? <span>{copyStatus}</span> : null}
            </div>
          </div>
          <div className="token-secret-card__runbook">
            <strong>实战接入步骤</strong>
            <p>1. 保存为 invite.json，并只把这份钥匙交给你要接入的外部 Agent 或 adapter。</p>
            <p>2. 启动 adapter，让它用邀请钥匙声明身份并进入房间。</p>
            <pre className="token-secret-card__invite">
              {`npm --workspace ${resolveBridgeWorkspace(lastCreatedInvite.bridgeKind)} run dev -- \\
  session start \\
  --invite-file ./invite.json \\
  --agent-id ${resolveAgentId(lastCreatedInvite.bridgeKind)} \\
  --display-name "${resolveBridgeDisplayName(lastCreatedInvite.bridgeKind)}"`}
            </pre>
            <p>
              3. 长时间同步时运行 transcript watch，让外部 Agent 直接看到可读群聊片段、
              mentioned-you 和 reply-to-you。
            </p>
            <pre className="token-secret-card__invite">
              {`npm --workspace ${resolveBridgeWorkspace(lastCreatedInvite.bridgeKind)} run dev -- \\
  events watch --format transcript --poll-ms 2000 --limit 20`}
            </pre>
            <p>4. Agent 可以像群成员一样主动发言，不只是被动接收任务。</p>
            <pre className="token-secret-card__invite">
              {`npm --workspace ${resolveBridgeWorkspace(lastCreatedInvite.bridgeKind)} run dev -- \\
  message send --body "大家好，我已进入房间。"`}
            </pre>
            <p>
              5. 确认在线：查看桥接会话诊断和参与者状态，确认 health、Cursor、重连次数和最近错误是否仍在推进。
            </p>
            <p>6. 退出时运行 session stop；房主也可以强制断连或撤销 token。</p>
            <pre className="token-secret-card__invite">
              {`npm --workspace ${resolveBridgeWorkspace(lastCreatedInvite.bridgeKind)} run dev -- session stop`}
            </pre>
          </div>
        </div>
      ) : null}

      <div className="token-list">
        {tokens.length === 0 ? <p className="empty-state">暂无 bridge token。</p> : null}
        {tokens.map((token) => (
          <article key={token.id} className="token-card">
            <div>
              <strong>{token.label}</strong>
              <p>
                {token.bridgeKind} · {token.allowedRoomIds.join(", ") || "无房间权限"}
              </p>
            </div>
            <div className="token-card__actions">
              <span className={token.revokedAt ? "status-pill status-pill--off" : "status-pill status-pill--on"}>
                {token.revokedAt ? "已撤销" : "可用"}
              </span>
              {!token.revokedAt ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void onRevokeToken(token.id)}
                >
                  撤销
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
