export type ParticipantViewModel = {
  id: string;
  displayName: string;
  type: "human" | "agent";
};

type ParticipantListProps = {
  participants: ParticipantViewModel[];
};

export function ParticipantList({ participants }: ParticipantListProps) {
  const humans = participants.filter((participant) => participant.type === "human");
  const agents = participants.filter((participant) => participant.type === "agent");

  return (
    <div className="participant-groups">
      <section className="participant-group">
        <h3>人类</h3>
        {humans.length === 0 ? <p className="empty-state">暂无在线人类。</p> : null}
        {humans.map((participant) => (
          <div key={participant.id} className="participant-card participant-card--human">
            <strong>{participant.displayName}</strong>
            <span>{participant.id}</span>
          </div>
        ))}
      </section>

      <section className="participant-group">
        <h3>智能体</h3>
        {agents.length === 0 ? <p className="empty-state">暂无智能体接入。</p> : null}
        {agents.map((participant) => (
          <div key={participant.id} className="participant-card participant-card--agent">
            <strong>{participant.displayName}</strong>
            <span>{participant.id}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
