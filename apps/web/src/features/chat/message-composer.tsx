import { useEffect, useId, useState } from "react";

import type { UploadAttachmentResponse } from "../../api/client";
import { UploadButton } from "../uploads/upload-button";

export type MessageComposerSubmit = {
  speakerParticipantId: string;
  body: string;
  mentions?: MessageComposerMention[];
  replyToMessageId?: string;
};

export type MessageComposerMentionTarget = {
  id: string;
  displayName: string;
};

export type MessageComposerMention = {
  participantId: string;
  displayName: string;
};

export type MessageComposerDraft = {
  id: string;
  body: string;
  mentions?: MessageComposerMention[];
  replyToMessageId?: string;
};

type MessageComposerProps = {
  speakerParticipantId: string;
  onSend: (payload: MessageComposerSubmit) => void | Promise<void>;
  onUpload?: (response: UploadAttachmentResponse) => void | Promise<void>;
  uploadFile?: (file: File) => Promise<UploadAttachmentResponse>;
  mentionTargets?: MessageComposerMentionTarget[];
  draft?: MessageComposerDraft | null;
  disabled?: boolean;
};

export function MessageComposer({
  speakerParticipantId,
  onSend,
  onUpload,
  uploadFile,
  mentionTargets = [],
  draft = null,
  disabled = false
}: MessageComposerProps) {
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<MessageComposerMention[]>([]);
  const [replyToMessageId, setReplyToMessageId] = useState<string | undefined>();
  const textareaId = useId();

  useEffect(() => {
    if (draft) {
      setBody(draft.body);
      setMentions(draft.mentions ?? []);
      setReplyToMessageId(draft.replyToMessageId);
    }
  }, [draft?.id]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextBody = body.trim();
    if (!nextBody || disabled) {
      return;
    }

    const activeMentions = mentions.filter((mention) => nextBody.includes(`@${mention.displayName}`));

    await onSend({
      speakerParticipantId,
      body: nextBody,
      ...(activeMentions.length > 0 ? { mentions: activeMentions } : {}),
      ...(replyToMessageId ? { replyToMessageId } : {})
    });
    setBody("");
    setMentions([]);
    setReplyToMessageId(undefined);
  }

  function insertMention(target: MessageComposerMentionTarget) {
    const structuredMention = {
      participantId: target.id,
      displayName: target.displayName
    };
    setMentions((current) =>
      current.some((mention) => mention.participantId === structuredMention.participantId)
        ? current
        : [...current, structuredMention]
    );
    setBody((current) => {
      const mention = `@${target.displayName} `;
      if (current.startsWith(mention)) {
        return current;
      }

      return current.trim().length > 0 ? `${mention}${current}` : mention;
    });
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <label className="composer__label" htmlFor={textareaId}>
        当前说话者：{speakerParticipantId}
      </label>
      {mentionTargets.length > 0 ? (
        <div className="composer__mentions" aria-label="指名发言">
          <span>指名发言</span>
          {mentionTargets.map((target) => (
            <button
              key={target.id}
              type="button"
              className="mention-button"
              disabled={disabled}
              onClick={() => insertMention(target)}
            >
              对 {target.displayName} 说
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        id={textareaId}
        className="composer__input"
        rows={4}
        value={body}
        disabled={disabled}
        onChange={(event) => setBody(event.target.value)}
        placeholder="输入你要同步到当前房间的内容"
      />
      <div className="composer__actions">
        {uploadFile && onUpload ? (
          <UploadButton disabled={disabled} uploadFile={uploadFile} onUploaded={onUpload} />
        ) : null}
        <button type="submit" className="primary-button" disabled={disabled || body.trim().length === 0}>
          发送
        </button>
      </div>
    </form>
  );
}
