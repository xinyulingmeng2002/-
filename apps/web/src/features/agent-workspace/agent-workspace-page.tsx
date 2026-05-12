import { useEffect, useState, type ChangeEvent } from "react";

import type { MessageEventRecord, PrivateMemoryOverview } from "../../api/client";
import {
  fetchBridgeWorkspaceEvents,
  fetchBridgeWorkspacePrivateMemoryOverview,
  fetchBridgeWorkspaceSnapshot,
  shareBridgeWorkspacePrivateMemory,
  sendBridgeWorkspaceMessage,
  uploadBridgeWorkspaceFile,
  type BridgeWorkspaceEventBatch,
  type BridgeWorkspaceParticipant,
  type BridgeWorkspaceRequest,
  type BridgeWorkspaceSnapshot
} from "./bridge-workspace-client";

const DEFAULT_EVENT_LIMIT = 20;
const DEFAULT_POLL_MS = 3_000;

type WorkspaceConfig = BridgeWorkspaceRequest & {
  eventLimit: number;
};

function readQueryParam(name: string): string {
  return new URLSearchParams(window.location.search).get(name) ?? "";
}

function eventLabel(event: MessageEventRecord): string {
  return event.payload.body || event.kind;
}

function appendEvents(current: MessageEventRecord[], incoming: MessageEventRecord[]): MessageEventRecord[] {
  const seen = new Set(current.map((event) => event.eventId));
  const next = [...current];

  for (const event of incoming) {
    if (!seen.has(event.eventId)) {
      next.push(event);
      seen.add(event.eventId);
    }
  }

  return next;
}

function shouldRefreshSnapshotForEvents(events: MessageEventRecord[]): boolean {
  return events.some(
    (event) => event.kind === "memory.candidate.accepted" || event.kind === "memory.candidate.rejected"
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isMentionedForAgent(event: MessageEventRecord, snapshot: BridgeWorkspaceSnapshot): boolean {
  const body = event.payload.body ?? "";
  const names = [snapshot.agent.displayName, snapshot.agent.id].filter(Boolean);

  return names.some((name) => {
    const mentionPattern = new RegExp(`(^|\\s)@${escapeRegExp(name)}(?=$|\\s|[.,!?，。！？:：;；、])`, "u");

    return mentionPattern.test(body);
  });
}

function isReplyForAgent(event: MessageEventRecord, snapshot: BridgeWorkspaceSnapshot): boolean {
  const body = event.payload.body ?? "";
  const names = [snapshot.agent.displayName, snapshot.agent.id].filter(Boolean);

  return names.some((name) => {
    const replyPattern = new RegExp(`^>\\s*回复\\s+${escapeRegExp(name)}\\s*:`, "u");

    return replyPattern.test(body);
  });
}

function createWorkspaceConfig(input: {
  bridgeToken: string;
  agentId: string;
  sessionId: string;
  roomId: string;
  eventLimit: string;
}): WorkspaceConfig {
  const eventLimitValue = Number.parseInt(input.eventLimit, 10);

  return {
    baseUrl: import.meta.env.VITE_SERVER_ORIGIN ?? "",
    bridgeToken: input.bridgeToken.trim(),
    agentId: input.agentId.trim(),
    sessionId: input.sessionId.trim(),
    roomId: input.roomId.trim(),
    eventLimit: Number.isFinite(eventLimitValue) && eventLimitValue > 0 ? eventLimitValue : DEFAULT_EVENT_LIMIT
  };
}

function renderEvent(event: MessageEventRecord) {
  return (
    <article key={event.eventId} className="workspace-event-card">
      <div>
        <strong>{event.kind}</strong>
        <p>{eventLabel(event)}</p>
        {event.payload.attachments?.map((attachment) => (
          <small key={attachment.id}>{attachment.name}</small>
        ))}
      </div>
      <span>{event.eventId}</span>
    </article>
  );
}

function formatParticipantLine(participant: BridgeWorkspaceParticipant): string {
  return [
    participant.id,
    participant.type,
    participant.bridgeKind,
    participant.capabilities.join(", ") || null
  ]
    .filter(Boolean)
    .join(" · ");
}

export function AgentWorkspacePage() {
  const [bridgeToken, setBridgeToken] = useState("");
  const [agentId, setAgentId] = useState(readQueryParam("agentId"));
  const [sessionId, setSessionId] = useState(readQueryParam("sessionId"));
  const [roomId, setRoomId] = useState(readQueryParam("roomId"));
  const [eventLimit, setEventLimit] = useState(String(DEFAULT_EVENT_LIMIT));
  const [activeConfig, setActiveConfig] = useState<WorkspaceConfig | null>(null);
  const [snapshot, setSnapshot] = useState<BridgeWorkspaceSnapshot | null>(null);
  const [events, setEvents] = useState<MessageEventRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [privateMemoryOverview, setPrivateMemoryOverview] = useState<PrivateMemoryOverview[]>([]);
  const [statusText, setStatusText] = useState("等待 bridge token 与 session 信息。");
  const [errorText, setErrorText] = useState("");
  const mentionedEvents = snapshot ? events.filter((event) => isMentionedForAgent(event, snapshot)) : [];
  const repliedEvents = snapshot ? events.filter((event) => isReplyForAgent(event, snapshot)) : [];

  async function connectWorkspace() {
    const config = createWorkspaceConfig({
      bridgeToken,
      agentId,
      sessionId,
      roomId,
      eventLimit
    });

    if (!config.bridgeToken || !config.agentId || !config.sessionId || !config.roomId) {
      setErrorText("Bridge Token、Agent ID、Session ID 和 Room ID 都是必填项。");
      return;
    }

    setStatusText("正在加载 Agent 工作快照…");
    setErrorText("");

    try {
      const loadedSnapshot = await fetchBridgeWorkspaceSnapshot(config);
      const loadedPrivateMemoryOverview = await fetchBridgeWorkspacePrivateMemoryOverview({
        baseUrl: config.baseUrl,
        roomId: config.roomId
      });
      setSnapshot(loadedSnapshot);
      setPrivateMemoryOverview(loadedPrivateMemoryOverview);
      setEvents(loadedSnapshot.recentEvents);
      setNextCursor(loadedSnapshot.nextCursor);
      setActiveConfig(config);
      setStatusText("已连接，正在监听房间事件。");
    } catch {
      setActiveConfig(null);
      setStatusText("连接失败。");
      setErrorText("无法加载 Agent 工作快照，请检查 bridge token、session 与 roomId。");
    }
  }

  async function refreshPrivateMemoryOverview(config: WorkspaceConfig) {
    const loadedPrivateMemoryOverview = await fetchBridgeWorkspacePrivateMemoryOverview({
      baseUrl: config.baseUrl,
      roomId: config.roomId
    });
    setPrivateMemoryOverview(loadedPrivateMemoryOverview);
  }

  async function refreshWorkspaceAfterWrite(config: WorkspaceConfig) {
    const [loadedSnapshot, batch] = await Promise.all([
      fetchBridgeWorkspaceSnapshot(config),
      fetchBridgeWorkspaceEvents({
        ...config,
        afterEventId: nextCursor ?? undefined,
        limit: config.eventLimit
      })
    ]);

    setSnapshot(loadedSnapshot);
    setEvents((current) => appendEvents(appendEvents(current, loadedSnapshot.recentEvents), batch.items));
    setNextCursor(batch.nextCursor ?? loadedSnapshot.nextCursor);
  }

  async function sharePrivateMemory(overview: PrivateMemoryOverview) {
    if (!activeConfig || !overview.suggestedShareCandidate) {
      return;
    }

    setErrorText("");

    try {
      await shareBridgeWorkspacePrivateMemory({
        baseUrl: activeConfig.baseUrl,
        memoryId: overview.suggestedShareCandidate.memoryId,
        agentId: overview.agentId,
        candidateType: overview.suggestedShareCandidate.candidateType
      });
      await refreshPrivateMemoryOverview(activeConfig);
      await refreshWorkspaceAfterWrite(activeConfig);
      setStatusText("私有记忆已提交为共享候选，等待人工审核。");
    } catch {
      setErrorText("提交共享候选失败，请稍后重试。");
    }
  }

  async function sendWorkspaceMessage() {
    if (!activeConfig) {
      setErrorText("请先连接工作台。");
      return;
    }

    const body = messageBody.trim();
    if (!body) {
      setErrorText("消息内容不能为空。");
      return;
    }

    setErrorText("");

    try {
      const sent = await sendBridgeWorkspaceMessage({
        ...activeConfig,
        body
      });

      setEvents((current) => appendEvents(current, [sent]));
      setNextCursor(sent.eventId);
      setMessageBody("");
      await refreshWorkspaceAfterWrite(activeConfig);
      setStatusText("消息已发送。");
    } catch {
      setErrorText("消息发送失败，请稍后重试。");
    }
  }

  async function uploadWorkspaceAttachment(event: ChangeEvent<HTMLInputElement>) {
    if (!activeConfig) {
      setErrorText("请先连接工作台。");
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const body = messageBody.trim();
    setErrorText("");

    try {
      const uploaded = await uploadBridgeWorkspaceFile({
        baseUrl: activeConfig.baseUrl,
        file
      });
      const sent = await sendBridgeWorkspaceMessage({
        ...activeConfig,
        body,
        attachments: [uploaded.attachment]
      });

      setEvents((current) => appendEvents(current, [sent]));
      setNextCursor(sent.eventId);
      setMessageBody("");
      await refreshWorkspaceAfterWrite(activeConfig);
      setStatusText("附件消息已发送。");
    } catch {
      setErrorText("附件发送失败，请稍后重试。");
    } finally {
      event.target.value = "";
    }
  }

  useEffect(() => {
    if (!activeConfig) {
      return;
    }

    const config = activeConfig;
    let cancelled = false;

    async function pollEvents() {
      try {
        const batch: BridgeWorkspaceEventBatch = await fetchBridgeWorkspaceEvents({
          ...config,
          afterEventId: nextCursor ?? undefined,
          limit: config.eventLimit
        });

        if (cancelled) {
          return;
        }

        setEvents((current) => appendEvents(current, batch.items));
        setNextCursor(batch.nextCursor);
        if (shouldRefreshSnapshotForEvents(batch.items)) {
          const refreshedSnapshot = await fetchBridgeWorkspaceSnapshot(config);
          if (!cancelled) {
            setSnapshot(refreshedSnapshot);
          }
        }
        setStatusText(batch.items.length > 0 ? "收到新的房间事件。" : "监听中，暂无新事件。");
        setErrorText("");
      } catch {
        if (!cancelled) {
          setErrorText("事件监听失败，将在下一轮继续尝试。");
        }
      }
    }

    const intervalId = window.setInterval(() => {
      void pollEvents();
    }, DEFAULT_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeConfig, nextCursor]);

  return (
    <div className="workspace-shell">
      <header className="workspace-hero">
        <div>
          <span className="panel-eyebrow">Agent Workspace</span>
          <h1>Agent 工作台</h1>
          <p>独立入口，用 bridge token 拉取当前房间工作快照，并持续监听事件流。</p>
        </div>
        <a className="workspace-back-link" href="/">
          返回房间页
        </a>
      </header>

      <main className="workspace-grid">
        <section className="workspace-card workspace-card--control">
          <div className="workspace-card__header">
            <h2>连接信息</h2>
            <p>这些字段只用于当前浏览器工作台，不写入共享层。</p>
          </div>

          <div className="workspace-form">
            <label>
              Bridge Token
              <input
                type="password"
                value={bridgeToken}
                onChange={(event) => setBridgeToken(event.target.value)}
                placeholder="创建 bridge token 后粘贴到这里"
              />
            </label>
            <label>
              Agent ID
              <input value={agentId} onChange={(event) => setAgentId(event.target.value)} />
            </label>
            <label>
              Session ID
              <input value={sessionId} onChange={(event) => setSessionId(event.target.value)} />
            </label>
            <label>
              Room ID
              <input value={roomId} onChange={(event) => setRoomId(event.target.value)} />
            </label>
            <label>
              Event Limit
              <input value={eventLimit} onChange={(event) => setEventLimit(event.target.value)} />
            </label>
            <button type="button" onClick={() => void connectWorkspace()}>
              连接工作台
            </button>
          </div>

          <div className="workspace-status">
            <strong>状态</strong>
            <p>{statusText}</p>
            {errorText ? <span>{errorText}</span> : null}
          </div>

          <div className="workspace-composer">
            <label>
              消息内容
              <textarea
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                placeholder="输入 Agent 要发送到房间的消息"
                rows={5}
              />
            </label>
            <button type="button" onClick={() => void sendWorkspaceMessage()}>
              发送消息
            </button>
            <label className="workspace-upload-field">
              上传附件
              <input type="file" onChange={(event) => void uploadWorkspaceAttachment(event)} />
            </label>
          </div>
        </section>

        <section className="workspace-card workspace-card--snapshot">
          <div className="workspace-card__header">
            <h2>工作快照</h2>
            <p>来自 bridge egress workspace，面向当前 Agent 的房间上下文。</p>
          </div>

          {snapshot ? (
            <div className="workspace-stack">
              <article className="workspace-summary">
                <span>Agent</span>
                <h3>{snapshot.agent.displayName}</h3>
                <p>{snapshot.agent.id}</p>
                <small>{snapshot.agent.capabilities.join(", ") || "暂无能力标签"}</small>
              </article>

              {snapshot.latestSummary ? (
                <article className="workspace-summary">
                  <span>最新摘要</span>
                  <h3>{snapshot.latestSummary.roomId}</h3>
                  <p>{snapshot.latestSummary.summaryText}</p>
                  <small>
                    {snapshot.latestSummary.messageCount} 条消息 · {snapshot.latestSummary.participantCount} 位参与者
                  </small>
                </article>
              ) : null}

              <div className="workspace-columns">
                <article className="workspace-mini-card">
                  <h3>房间成员</h3>
                  {snapshot.participants.length === 0 ? <p>当前快照暂无房间成员。</p> : null}
                  {snapshot.participants.map((participant) => (
                    <div key={participant.id} className="workspace-knowledge-row">
                      <strong>{participant.displayName}</strong>
                      <p>{formatParticipantLine(participant)}</p>
                      <small>最后活跃 {participant.lastSeenAt}</small>
                    </div>
                  ))}
                </article>

                <article className="workspace-mini-card workspace-mini-card--mentions">
                  <h3>提到我的消息</h3>
                  {mentionedEvents.length === 0 ? <p>当前没有提到我的消息。</p> : null}
                  {mentionedEvents.map((event) => (
                    <div key={event.eventId} className="workspace-knowledge-row">
                      <strong>{event.payload.speakerParticipantId ?? "unknown"}</strong>
                      <p>{event.payload.body}</p>
                      <small>{event.eventId}</small>
                    </div>
                  ))}
                </article>

                <article className="workspace-mini-card workspace-mini-card--replies">
                  <h3>回复我的消息</h3>
                  {repliedEvents.length === 0 ? <p>当前没有回复我的消息。</p> : null}
                  {repliedEvents.map((event) => (
                    <div key={event.eventId} className="workspace-knowledge-row">
                      <strong>{event.payload.speakerParticipantId ?? "unknown"}</strong>
                      <p>{event.payload.body}</p>
                      <small>{event.eventId}</small>
                    </div>
                  ))}
                </article>

                <article className="workspace-mini-card">
                  <h3>当前工作记忆</h3>
                  <strong>待办</strong>
                  <p>{snapshot.workMemory?.todoItems.join(" / ") || "暂无条目"}</p>
                  <strong>阻塞</strong>
                  <p>{snapshot.workMemory?.blockerItems.join(" / ") || "暂无条目"}</p>
                  <strong>决策</strong>
                  <p>{snapshot.workMemory?.decisionItems.join(" / ") || "暂无条目"}</p>
                </article>

                <article className="workspace-mini-card">
                  <h3>共享知识</h3>
                  {snapshot.sharedKnowledge.length === 0 ? <p>暂无共享知识。</p> : null}
                  {snapshot.sharedKnowledge.map((item) => (
                    <div key={item.knowledgeId} className="workspace-knowledge-row">
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </div>
                  ))}
                </article>

                <article className="workspace-mini-card">
                  <h3>待审核候选</h3>
                  {snapshot.memoryCandidates.length === 0 ? <p>当前房间暂无待审核候选。</p> : null}
                  {snapshot.memoryCandidates.map((candidate) => (
                    <div key={candidate.candidateId} className="workspace-knowledge-row">
                      <strong>{candidate.title}</strong>
                      <p>{candidate.body}</p>
                      <small>
                        {candidate.candidateType} · {candidate.status} · {candidate.proposedBy}
                      </small>
                    </div>
                  ))}
                </article>

                <article className="workspace-mini-card">
                  <h3>私有记忆状态</h3>
                  {privateMemoryOverview.length === 0 ? <p>当前房间暂无私有记忆状态。</p> : null}
                  {privateMemoryOverview.map((overview) => (
                    <div key={`${overview.agentId}:${overview.roomId}`} className="workspace-knowledge-row">
                      <strong>{overview.agentId}</strong>
                      <p>
                        {overview.totalMemories} 条私有记忆 / {overview.shareableMemories} 条可提交候选
                      </p>
                      {overview.pendingShareCandidate ? (
                        <small>已提交候选 {overview.pendingShareCandidate.candidateId}</small>
                      ) : null}
                      {overview.latestShareOutcome ? (
                        <small>
                          最近审核 {overview.latestShareOutcome.candidateId}:{" "}
                          {overview.latestShareOutcome.status}
                        </small>
                      ) : null}
                      {overview.suggestedShareCandidate ? (
                        <button type="button" onClick={() => void sharePrivateMemory(overview)}>
                          提交为共享候选
                        </button>
                      ) : null}
                    </div>
                  ))}
                </article>
              </div>
            </div>
          ) : (
            <p className="empty-state">连接后会显示 Agent 当前能看到的房间工作面。</p>
          )}
        </section>

        <section className="workspace-card workspace-card--events">
          <div className="workspace-card__header">
            <h2>事件流</h2>
            <p>cursor: {nextCursor ?? "尚未建立"}</p>
          </div>

          <div className="workspace-event-list">
            {events.length === 0 ? <p className="empty-state">暂无事件。</p> : null}
            {events.map(renderEvent)}
          </div>
        </section>
      </main>
    </div>
  );
}
