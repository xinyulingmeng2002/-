import type { AttachmentRecord } from "../../api/client";

export type TimelineMessage = {
  id: string;
  kind: "chat" | "system";
  body: string;
  speakerParticipantId: string;
  timestamp: string;
  attachments?: AttachmentRecord[];
  mentions?: Array<{
    participantId: string;
    displayName: string;
  }>;
  replyToMessageId?: string;
};

type MessageListProps = {
  messages: TimelineMessage[];
  onReply?: (message: TimelineMessage) => void;
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

function formatAttachmentSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 102.4) / 10} KB`;
  }

  return `${Math.round(sizeBytes / (1024 * 102.4)) / 10} MB`;
}

function parsePublicReplyReference(body: string): { quote: string; body: string } | null {
  const match = /^>\s*(回复\s+[^\n]+)(?:\n{2,}([\s\S]*))?$/u.exec(body);
  if (!match) {
    return null;
  }

  return {
    quote: match[1].trim(),
    body: match[2] ?? ""
  };
}

function renderInlineMessageText(body: string) {
  const parts = body.split(/(@[\p{L}\p{N}_-]+)/gu);

  return parts.map((part, index) =>
    /^@[\p{L}\p{N}_-]+$/u.test(part) ? (
      <span key={`${part}:${index}`} className="message-mention">
        {part}
      </span>
    ) : (
      <span key={`${part}:${index}`}>{part}</span>
    )
  );
}

function renderMessageBody(body: string) {
  const replyReference = parsePublicReplyReference(body);
  if (!replyReference) {
    return renderInlineMessageText(body);
  }

  return (
    <>
      <blockquote className="message-quote">{replyReference.quote}</blockquote>
      {replyReference.body ? (
        <span className="message-body-text">{renderInlineMessageText(replyReference.body)}</span>
      ) : null}
    </>
  );
}

export function MessageList({ messages, onReply }: MessageListProps) {
  if (messages.length === 0) {
    return <div className="empty-state empty-state--timeline">还没有消息，先发一条把链路打通。</div>;
  }

  return (
    <div className="message-list" aria-label="消息时间线">
      {messages.map((message) => (
        <article key={message.id} className={`message-card message-card--${message.kind}`}>
          <header className="message-card__header">
            <span className="speaker-chip">{formatSpeakerLabel(message.speakerParticipantId)}</span>
            <div className="message-card__meta">
              {onReply && message.kind === "chat" ? (
                <button
                  type="button"
                  className="message-reply-button"
                  aria-label={`回复 ${formatSpeakerLabel(message.speakerParticipantId)} 的消息`}
                  onClick={() => onReply(message)}
                >
                  回复
                </button>
              ) : null}
              <time dateTime={message.timestamp}>{new Date(message.timestamp).toLocaleTimeString("zh-CN")}</time>
            </div>
          </header>
          {message.body ? <div className="message-card__body">{renderMessageBody(message.body)}</div> : null}
          {message.attachments?.length ? (
            <div className="message-card__attachments">
              {message.attachments.map((attachment) =>
                attachment.kind === "image" ? (
                  <div key={attachment.id} className="attachment-card attachment-card--image">
                    <img
                      className="attachment-card__preview"
                      src={attachment.url}
                      alt={attachment.name}
                    />
                    <div className="attachment-card__meta">
                      <div>
                        <strong>{attachment.name}</strong>
                        <span>
                          {attachment.mimeType} · {formatAttachmentSize(attachment.sizeBytes)}
                        </span>
                      </div>
                      <a href={attachment.url} target="_blank" rel="noreferrer">
                        查看原图
                      </a>
                    </div>
                  </div>
                ) : (
                  <div key={attachment.id} className="attachment-card attachment-card--file">
                    <div className="attachment-card__file-badge">{attachment.kind.toUpperCase()}</div>
                    <div className="attachment-card__meta">
                      <div>
                        <strong>{attachment.name}</strong>
                        <span>
                          {attachment.mimeType} · {formatAttachmentSize(attachment.sizeBytes)}
                        </span>
                      </div>
                      <a href={attachment.url} target="_blank" rel="noreferrer">
                        打开文件
                      </a>
                    </div>
                  </div>
                )
              )}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
