import { useEffect, useState } from "react";

import type {
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
  }) => Promise<BridgeTokenCreateResponse>;
  onRevokeToken: (id: string) => Promise<void>;
};

function parseAllowedRoomIds(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
  const [lastCreatedToken, setLastCreatedToken] = useState<string | null>(null);

  useEffect(() => {
    setAllowedRoomIds((current) => (current ? current : activeRoomId));
  }, [activeRoomId]);

  async function handleCreate() {
    setIsSubmitting(true);

    try {
      const created = await onCreateToken({
        label: label.trim() || `${bridgeKind}-bridge`,
        bridgeKind,
        allowedRoomIds: parseAllowedRoomIds(allowedRoomIds)
      });

      setLabel("");
      setLastCreatedToken(created.token);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="agent-section">
      <div className="agent-section__header">
        <h3>接入令牌</h3>
        <p>创建后只展示一次明文 token。</p>
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

      {lastCreatedToken ? (
        <div className="token-secret-card">
          <strong>新令牌</strong>
          <code>{lastCreatedToken}</code>
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
