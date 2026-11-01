import { useRef, useState } from "react";
import type { AttachmentPayload } from "../media/estimate";
import {
  FILE_ACCEPT,
  formatBytes,
  formatDuration,
  readAttachments,
  releaseAttachment,
  type LocalAttachment,
} from "./attachments";

export function Composer(props: {
  prompt: string;
  maxCharacters: number;
  placeholder?: string;
  accent?: "current" | "compared";
  onPrompt: (text: string) => void;
  onAttachments: (attachments: AttachmentPayload[]) => void;
}): JSX.Element {
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function publish(next: LocalAttachment[]): void {
    const payload: AttachmentPayload[] = next.map(({ previewUrl: _preview, ...attachment }) => attachment);
    props.onAttachments(payload);
  }

  async function addFiles(files: FileList | File[]): Promise<void> {
    const result = await readAttachments(files, attachments.length, props.maxCharacters);
    if (result.attachments.length === 0) {
      setFileError(result.error);
      return;
    }
    const next = [...attachments, ...result.attachments];
    setAttachments(next);
    setFileError(result.error);
    publish(next);
  }

  function remove(id: string): void {
    const target = attachments.find((attachment) => attachment.id === id);
    if (target) {
      releaseAttachment(target);
    }
    const next = attachments.filter((attachment) => attachment.id !== id);
    setAttachments(next);
    setFileError(null);
    publish(next);
  }

  return (
    <div
      className={`composer${props.accent ? ` accent-${props.accent}` : ""}${dragOver ? " drag" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        if (event.dataTransfer.files.length > 0) {
          void addFiles(event.dataTransfer.files);
        }
      }}
    >
      {attachments.length > 0 && (
        <ul className="attachments">
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              {attachment.previewUrl && <img src={attachment.previewUrl} alt="" />}
              <span className="attachment-copy">
                <strong>{attachment.name}</strong>
                <span>
                  {labelFor(attachment)}
                  {formatDuration(attachment.durationSeconds) ? ` · ${formatDuration(attachment.durationSeconds)}` : ""}
                  {` · ${formatBytes(attachment.bytes)}`}
                </span>
              </span>
              <button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => remove(attachment.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        className="prompt-box"
        value={props.prompt}
        placeholder={props.placeholder ?? "Type a prompt, or attach a file"}
        onChange={(event) => props.onPrompt(event.target.value)}
        onPaste={(event) => {
          if (event.clipboardData.files.length > 0) {
            event.preventDefault();
            void addFiles(event.clipboardData.files);
          }
        }}
      />
      <div className="composer-bar">
        <button type="button" className="icon-button" aria-label="Attach files" onClick={() => inputRef.current?.click()}>
          <AttachIcon />
          <span>Attach</span>
        </button>
        <input
          ref={inputRef}
          className="file-input"
          type="file"
          multiple
          accept={FILE_ACCEPT}
          onChange={(event) => {
            const files = event.target.files;
            if (files && files.length > 0) {
              void addFiles(files);
            }
            event.target.value = "";
          }}
        />
        <span className="note">Documents, images, video, and audio stay on this machine.</span>
      </div>
      {fileError && <p className="error">{fileError}</p>}
    </div>
  );
}

function labelFor(attachment: LocalAttachment): string {
  switch (attachment.kind) {
    case "document":
      return "Document";
    case "image":
      return "Image";
    case "video":
      return "Video";
    case "audio":
      return "Audio";
  }
}

function AttachIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9.8 2.2a3.2 3.2 0 0 0-4.5 4.5l4.3 4.3a1.9 1.9 0 1 0 2.7-2.7L7.6 3.6a.7.7 0 0 0-1 1l4.7 4.7a.5.5 0 0 1-.7.7L6.3 6a1.8 1.8 0 1 1 2.5-2.5l4.4 4.4a3.2 3.2 0 0 1-4.5 4.5L3.9 7.6a.7.7 0 1 0-1 1l4.8 4.8a4.6 4.6 0 0 0 6.5-6.5L9.8 2.2z"
      />
    </svg>
  );
}
