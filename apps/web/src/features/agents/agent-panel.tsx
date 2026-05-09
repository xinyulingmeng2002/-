import type {
  BridgeSessionRecord,
  MemoryCandidateRecord,
  BridgeTokenCreateResponse,
  BridgeTokenRecord,
  ParticipantRecord,
  PrivateMemoryOverview,
  RoomSummaryRecord,
  SharedKnowledgeRecord,
  WorkMemoryRecord,
  BridgeKind
} from "../../api/client";
import { CandidateReviewPanel } from "./candidate-review-panel";
import { PrivateMemoryOverviewPanel } from "./private-memory-overview-panel";
import { SharedKnowledgePanel } from "./shared-knowledge-panel";
import { TokenManager } from "./token-manager";
import { WorkMemoryPanel } from "./work-memory-panel";

type AgentPanelProps = {
  activeRoomId: string;
  participants: ParticipantRecord[];
  sessions: BridgeSessionRecord[];
  tokens: BridgeTokenRecord[];
  candidates: MemoryCandidateRecord[];
  sharedKnowledge: SharedKnowledgeRecord[];
  privateMemoryOverview: PrivateMemoryOverview[];
  workMemory: WorkMemoryRecord | null;
  latestSummary: RoomSummaryRecord | null;
  onCreateToken: (input: {
    label: string;
    bridgeKind: BridgeKind;
    allowedRoomIds: string[];
  }) => Promise<BridgeTokenCreateResponse>;
  onRevokeToken: (id: string) => Promise<void>;
  onAcceptCandidate: (candidateId: string) => Promise<void>;
  onRejectCandidate: (candidateId: string) => Promise<void>;
};

function resolveDisplayName(participants: ParticipantRecord[], agentId: string): string {
  return participants.find((participant) => participant.id === agentId)?.displayName ?? agentId;
}

export function AgentPanel({
  activeRoomId,
  participants,
  sessions,
  tokens,
  candidates,
  sharedKnowledge,
  privateMemoryOverview,
  workMemory,
  latestSummary,
  onCreateToken,
  onRevokeToken,
  onAcceptCandidate,
  onRejectCandidate
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

      <CandidateReviewPanel
        candidates={candidates}
        onAcceptCandidate={onAcceptCandidate}
        onRejectCandidate={onRejectCandidate}
      />

      <SharedKnowledgePanel items={sharedKnowledge} />

      <PrivateMemoryOverviewPanel
        items={privateMemoryOverview}
        resolveDisplayName={(agentId) => resolveDisplayName(participants, agentId)}
      />

      <WorkMemoryPanel workMemory={workMemory} />

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
