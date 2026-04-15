import type {
  BridgeSessionRecord,
  BridgeTokenCreateResponse,
  BridgeTokenRecord,
  ParticipantRecord,
  RoomSummaryRecord,
  BridgeKind
} from "../../api/client";
import { TokenManager } from "./token-manager";

type AgentPanelProps = {
  activeRoomId: string;
  participants: ParticipantRecord[];
  sessions: BridgeSessionRecord[];
  tokens: BridgeTokenRecord[];
  latestSummary: RoomSummaryRecord | null;
  onCreateToken: (input: {
    label: string;
    bridgeKind: BridgeKind;
    allowedRoomIds: string[];
  }) => Promise<BridgeTokenCreateResponse>;
  onRevokeToken: (id: string) => Promise<void>;
};

function resolveDisplayName(participants: ParticipantRecord[], agentId: string): string {
  return participants.find((participant) => participant.id === agentId)?.displayName ?? agentId;
}

export function AgentPanel({
  activeRoomId,
  participants,
  sessions,
  tokens,
  latestSummary,
  onCreateToken,
  onRevokeToken
}: AgentPanelProps) {
  const connectedSessions = sessions.filter((session) => session.status === "connected");

  return (
    <div className="agent-panel">
      <section className="agent-section">
        <div className="agent-section__header">
          <h3>在线桥接</h3>
          <p>展示当前已接入的智能体会话与房间绑定。</p>
        </div>
        <div className="agent-status-list">
          {connectedSessions.length === 0 ? <p className="empty-state">暂无在线 bridge session。</p> : null}
          {connectedSessions.map((session) => (
            <article key={session.id} className="agent-status-card">
              <div>
                <strong>{resolveDisplayName(participants, session.agentId)}</strong>
                <p>{session.agentId}</p>
              </div>
              <div className="agent-status-card__meta">
                <span className="status-pill status-pill--on">connected</span>
                <span>{session.activeRoomIds.join(", ") || "未加入房间"}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <TokenManager
        activeRoomId={activeRoomId}
        tokens={tokens}
        onCreateToken={onCreateToken}
        onRevokeToken={onRevokeToken}
      />

      <section className="agent-section">
        <div className="agent-section__header">
          <h3>最新摘要</h3>
          <p>房间沉淀层当前只保留可回看快照。</p>
        </div>
        {latestSummary ? (
          <article className="summary-card summary-card--panel">
            <strong>{latestSummary.roomId}</strong>
            <p>{latestSummary.summaryText}</p>
            <span>
              {latestSummary.messageCount} 条消息 · {latestSummary.participantCount} 位参与者
            </span>
          </article>
        ) : (
          <p className="empty-state">当前房间还没有摘要快照。</p>
        )}
      </section>
    </div>
  );
}
