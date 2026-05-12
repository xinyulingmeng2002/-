import { useId, useState } from "react";

import type { UploadAttachmentResponse } from "../../api/client";
import { UploadButton } from "../uploads/upload-button";

export type MessageComposerSubmit = {
  speakerParticipantId: string;
  body: string;
};

export type MessageComposerMentionTarget = {
  id: string;
  displayName: string;
};

type MessageComposerProps = {
  speakerParticipantId: string;
  onSend: (payload: MessageComposerSubmit) => void | Promise<void>;
  onUpload?: (response: UploadAttachmentResponse) => void | Promise<void>;
  uploadFile?: (file: File) => Promise<UploadAttachmentResponse>;
  mentionTargets?: MessageComposerMentionTarget[];
  disabled?: boolean;
};

export function MessageComposer({
  speakerParticipantId,
  onSend,
  onUpload,
  uploadFile,
  mentionTargets = [],
  disabled = false
}: MessageComposerProps) {
  const [body, setBody] = useState("");
  const textareaId = useId();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextBody = body.trim();
    if (!nextBody || disabled) {
      return;
    }

    await onSend({
      speakerParticipantId,
      body: nextBody
    });
    setBody("");
  }

  function insertMention(target: MessageComposerMentionTarget) {
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
