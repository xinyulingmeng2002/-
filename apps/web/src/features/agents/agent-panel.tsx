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
    baseUrl?: string;
  }) => Promise<BridgeTokenCreateResponse>;
  onRevokeToken: (id: string) => Promise<void>;
  onDisconnectSession?: (id: string) => Promise<void>;
  onAcceptCandidate: (candidateId: string) => Promise<void>;
  onRejectCandidate: (candidateId: string) => Promise<void>;
  onSharePrivateMemory: (input: {
    memoryId: string;
    agentId: string;
    candidateType: "summary" | "todo" | "blocker" | "decision";
  }) => Promise<void>;
  onOpenAgentWorkspace?: (input: {
    roomId: string;
    agentId: string;
    sessionId: string;
  }) => void;
};

function resolveDisplayName(participants: ParticipantRecord[], agentId: string): string {
  return participants.find((participant) => participant.id === agentId)?.displayName ?? agentId;
}

function formatSecondsAgo(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) {
    return "最后心跳未知";
  }

  return `最后心跳 ${seconds} 秒前`;
}

function formatExpiresIn(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) {
    return "过期时间未知";
  }

  return seconds >= 0 ? `TTL 剩余 ${seconds} 秒` : `TTL 已过期 ${Math.abs(seconds)} 秒`;
}

function formatBridgeDiagnostics(session: BridgeSessionRecord): string[] {
  if (!session.diagnostics) {
    return [];
  }

  const lines: string[] = [];

  if (session.diagnostics.lastEventId) {
    lines.push(`Cursor ${session.diagnostics.lastEventId}`);
  }

  if (
    session.diagnostics.reconnectCount !== undefined ||
    session.diagnostics.consecutiveFailures !== undefined
  ) {
    lines.push(
      `重连 ${session.diagnostics.reconnectCount ?? 0} 次 · 连续失败 ${
        session.diagnostics.consecutiveFailures ?? 0
      } 次`
    );
  }

  if (session.diagnostics.lastError) {
    lines.push(`最近错误 ${session.diagnostics.lastError}`);
  }

  return lines;
}

function resolveBridgeObservation(session: BridgeSessionRecord): {
  title: string;
  detail: string;
  tone: "normal" | "warning" | "offline";
} {
  if (session.health?.reason === "heartbeat_expired") {
    return {
      title: "心跳过期",
      detail: "建议重启 adapter，或强制断连后重新接入。",
      tone: "offline"
    };
  }

  if (session.status !== "connected" || session.health?.state === "offline") {
    return {
      title: "已断开",
      detail: "该 Agent 当前不在稳定连接中，可重新发送邀请钥匙接入。",
      tone: "offline"
    };
  }

  const consecutiveFailures = session.diagnostics?.consecutiveFailures ?? 0;
  if (consecutiveFailures > 0 || session.diagnostics?.lastError) {
    return {
      title: "监听异常",
      detail: `连续失败 ${consecutiveFailures} 次，请检查 adapter watch 或网络连接。`,
      tone: "warning"
    };
  }

  if (session.diagnostics?.lastEventId) {
    return {
      title: "监听正常",
      detail: `Cursor ${session.diagnostics.lastEventId} 正在推进，暂无连续失败。`,
      tone: "normal"
    };
  }

  return {
    title: "等待事件",
    detail: "心跳正常，但暂未上报 Cursor；请确认 adapter watch 已启动。",
    tone: "warning"
  };
}

function resolveAgentPresence(
  sessions: BridgeSessionRecord[],
  activeRoomId: string,
  agentId: string
): "在线" | "离线" | "未接入" {
  const session = sessions.find(
    (item) => item.agentId === agentId && item.activeRoomIds.includes(activeRoomId)
  );

  if (!session) {
    return "未接入";
  }

  return session.status === "connected" ? "在线" : "离线";
}

function formatAgentCapabilities(participant: ParticipantRecord): string {
  const bridgeKind = participant.bridgeKind ?? "local";
  const capabilities = participant.capabilities.join(", ") || "暂无能力标签";
  return `${bridgeKind} · ${capabilities}`;
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
  onDisconnectSession,
  onAcceptCandidate,
  onRejectCandidate,
  onSharePrivateMemory,
  onOpenAgentWorkspace
}: AgentPanelProps) {
  const sortedSessions = [...sessions].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "connected" ? -1 : 1;
    }

    return right.lastSeenAt.localeCompare(left.lastSeenAt);
  });
  const roomAgents = participants
    .filter((participant) => participant.type === "agent")
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  return (
    <div className="agent-panel">
      <section className="agent-section">
        <div className="agent-section__header">
          <h3>房间智能体</h3>
          <p>房间里的 Agent 是群成员，不只是 bridge session。</p>
        </div>
        <div className="agent-member-list">
          {roomAgents.length === 0 ? <p className="empty-state">当前房间暂无智能体成员。</p> : null}
          {roomAgents.map((participant) => {
            const presence = resolveAgentPresence(sessions, activeRoomId, participant.id);

            return (
              <article key={participant.id} className="agent-member-card">
                <div>
                  <strong>{participant.displayName}</strong>
                  <p>{participant.id}</p>
                  <p>{formatAgentCapabilities(participant)}</p>
                </div>
                <span
                  className={
                    presence === "在线"
                      ? "status-pill status-pill--on"
                      : "status-pill status-pill--off"
                  }
                >
                  {presence} · 最后活跃 {participant.lastSeenAt}
                </span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="agent-section">
        <div className="agent-section__header">
          <h3>桥接会话</h3>
          <p>展示当前和最近断开的智能体会话、心跳状态与房间绑定。</p>
        </div>
        <div className="agent-status-list">
          {sortedSessions.length === 0 ? <p className="empty-state">暂无 bridge session。</p> : null}
          {sortedSessions.map((session) => {
            const observation = resolveBridgeObservation(session);

            return (
              <article key={session.id} className="agent-status-card">
                <div>
                  <strong>{resolveDisplayName(participants, session.agentId)}</strong>
                  <p>{session.agentId}</p>
                  <p>{formatSecondsAgo(session.health?.lastSeenSecondsAgo)}</p>
                  <p>{formatExpiresIn(session.health?.expiresInSeconds)}</p>
                  <div className="agent-status-card__observation">
                    <span
                      className={
                        observation.tone === "normal"
                          ? "status-pill status-pill--on"
                          : "status-pill status-pill--off"
                      }
                    >
                      {observation.title}
                    </span>
                    <p>{observation.detail}</p>
                  </div>
                  {formatBridgeDiagnostics(session).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                <div className="agent-status-card__meta">
                  <span
                    className={
                      session.status === "connected"
                        ? "status-pill status-pill--on"
                        : "status-pill status-pill--off"
                    }
                  >
                    {session.status === "connected" ? "connected" : "offline"}
                  </span>
                  <span>{session.health?.reason ?? "health_unknown"}</span>
                  <span>{session.activeRoomIds.join(", ") || "未加入房间"}</span>
                </div>
                {onOpenAgentWorkspace &&
                session.status === "connected" &&
                session.activeRoomIds.includes(activeRoomId) ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      onOpenAgentWorkspace({
                        roomId: activeRoomId,
                        agentId: session.agentId,
                        sessionId: session.id
                      })
                    }
                  >
                    打开 {resolveDisplayName(participants, session.agentId)} 工作台
                  </button>
                ) : null}
                {onDisconnectSession && session.status === "connected" ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void onDisconnectSession(session.id)}
                  >
                    强制断连 {resolveDisplayName(participants, session.agentId)}
                  </button>
                ) : null}
              </article>
            );
          })}
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
        onShareCandidate={onSharePrivateMemory}
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
