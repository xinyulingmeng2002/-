import { useRef, useState } from "react";

import type { UploadAttachmentResponse } from "../../api/client";

type UploadButtonProps = {
  disabled?: boolean;
  uploadFile: (file: File) => Promise<UploadAttachmentResponse>;
  onUploaded: (response: UploadAttachmentResponse) => void | Promise<void>;
};

export function UploadButton({ disabled = false, uploadFile, onUploaded }: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);
    try {
      const response = await uploadFile(file);
      await onUploaded(response);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        hidden
        type="file"
        onChange={handleChange}
      />
      <button
        type="button"
        className="secondary-button"
        disabled={disabled || isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? "上传中…" : "上传文件"}
      </button>
    </>
  );
}
