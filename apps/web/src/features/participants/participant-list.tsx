export type ParticipantViewModel = {
  id: string;
  displayName: string;
  type: "human" | "agent";
  status: "online" | "offline" | "not_joined";
};

type ParticipantListProps = {
  participants: ParticipantViewModel[];
  onMentionParticipant?: (participant: ParticipantViewModel) => void;
};

export function ParticipantList({ participants, onMentionParticipant }: ParticipantListProps) {
  const humans = participants.filter((participant) => participant.type === "human");
  const agents = participants.filter((participant) => participant.type === "agent");
  const statusLabel = {
    online: "在线",
    offline: "离线",
    not_joined: "未接入"
  } satisfies Record<ParticipantViewModel["status"], string>;

  return (
    <div className="participant-groups">
      <section className="participant-group">
        <h3>人类</h3>
        {humans.length === 0 ? <p className="empty-state">暂无在线人类。</p> : null}
        {humans.map((participant) => (
          <div key={participant.id} className="participant-card participant-card--human">
            <div>
              <strong>{participant.displayName}</strong>
              <span>{participant.id}</span>
              <span className={`participant-card__status participant-card__status--${participant.status}`}>
                成员状态：{statusLabel[participant.status]}
              </span>
            </div>
            {onMentionParticipant ? (
              <button
                type="button"
                className="participant-card__action"
                aria-label={`从成员列表对 ${participant.displayName} 说`}
                onClick={() => onMentionParticipant(participant)}
              >
                对 TA 说
              </button>
            ) : null}
          </div>
        ))}
      </section>

      <section className="participant-group">
        <h3>智能体</h3>
        {agents.length === 0 ? <p className="empty-state">暂无智能体接入。</p> : null}
        {agents.map((participant) => (
          <div key={participant.id} className="participant-card participant-card--agent">
            <div>
              <strong>{participant.displayName}</strong>
              <span>{participant.id}</span>
              <span className={`participant-card__status participant-card__status--${participant.status}`}>
                成员状态：{statusLabel[participant.status]}
              </span>
            </div>
            {onMentionParticipant ? (
              <button
                type="button"
                className="participant-card__action"
                aria-label={`从成员列表对 ${participant.displayName} 说`}
                onClick={() => onMentionParticipant(participant)}
              >
                对 TA 说
              </button>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}
