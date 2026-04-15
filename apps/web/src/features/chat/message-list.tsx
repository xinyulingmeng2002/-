export type TimelineMessage = {
  id: string;
  kind: "chat" | "system";
  body: string;
  speakerParticipantId: string;
  timestamp: string;
};

type MessageListProps = {
  messages: TimelineMessage[];
};

function formatSpeakerLabel(participantId: string): string {
  if (participantId === "human-1") {
    return "你";
  }
  if (participantId === "system") {
    return "系统";
  }
  if (participantId.startsWith("agent-")) {
    return participantId.replace(/^agent-/, "Agent ");
  }

  return participantId;
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return <div className="empty-state empty-state--timeline">还没有消息，先发一条把链路打通。</div>;
  }

  return (
    <div className="message-list" aria-label="消息时间线">
      {messages.map((message) => (
        <article key={message.id} className={`message-card message-card--${message.kind}`}>
          <header className="message-card__header">
            <span className="speaker-chip">{formatSpeakerLabel(message.speakerParticipantId)}</span>
            <time dateTime={message.timestamp}>{new Date(message.timestamp).toLocaleTimeString("zh-CN")}</time>
          </header>
          <p className="message-card__body">{message.body}</p>
        </article>
      ))}
    </div>
  );
}
