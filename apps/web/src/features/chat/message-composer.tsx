import { useId, useState } from "react";

import type { UploadAttachmentResponse } from "../../api/client";
import { UploadButton } from "../uploads/upload-button";

export type MessageComposerSubmit = {
  speakerParticipantId: string;
  body: string;
};

type MessageComposerProps = {
  speakerParticipantId: string;
  onSend: (payload: MessageComposerSubmit) => void | Promise<void>;
  onUpload?: (response: UploadAttachmentResponse) => void | Promise<void>;
  uploadFile?: (file: File) => Promise<UploadAttachmentResponse>;
  disabled?: boolean;
};

export function MessageComposer({
  speakerParticipantId,
  onSend,
  onUpload,
  uploadFile,
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

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <label className="composer__label" htmlFor={textareaId}>
        当前说话者：{speakerParticipantId}
      </label>
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
