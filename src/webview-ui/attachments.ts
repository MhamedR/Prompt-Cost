import type { AttachmentKind, AttachmentPayload } from "../media/estimate";

export interface LocalAttachment extends AttachmentPayload {
  previewUrl?: string;
}

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "json", "jsonl", "xml", "html", "css",
  "js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "java", "c", "h", "cpp",
  "cs", "yml", "yaml", "toml", "ini", "log", "sql", "sh", "tex", "svg",
]);

const MAX_FILES = 8;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const FILE_ACCEPT = [
  "image/*",
  "video/*",
  "audio/*",
  "text/*",
  ".pdf",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
].join(",");

export async function readAttachments(
  files: FileList | File[],
  existing: number,
  maxCharacters: number,
): Promise<{ attachments: LocalAttachment[]; error: string | null }> {
  const list = Array.from(files);
  const room = MAX_FILES - existing;
  if (room <= 0) {
    return { attachments: [], error: `You can attach up to ${MAX_FILES} files.` };
  }
  const accepted = list.slice(0, room);
  const error = list.length > room ? `Only ${MAX_FILES} files can be attached.` : null;
  const attachments: LocalAttachment[] = [];
  for (const file of accepted) {
    if (file.size > MAX_FILE_BYTES) {
      return { attachments, error: `${file.name} is larger than 25 MB.` };
    }
    const attachment = await readOne(file, maxCharacters);
    attachments.push(attachment);
    if (attachment.kind === "document" && attachment.text && attachment.text.length >= maxCharacters && file.size > maxCharacters) {
      return { attachments, error: `${file.name} was shortened to the character limit.` };
    }
  }
  return { attachments, error };
}

export function releaseAttachment(attachment: LocalAttachment): void {
  if (attachment.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number | undefined): string | null {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

async function readOne(file: File, maxCharacters: number): Promise<LocalAttachment> {
  const kind = kindFor(file);
  const id = crypto.randomUUID();
  const base = { id, name: file.name, kind, bytes: file.size };
  if (kind === "image") {
    const previewUrl = URL.createObjectURL(file);
    try {
      const size = await imageSize(previewUrl);
      return { ...base, previewUrl, width: size.width, height: size.height };
    } catch {
      return { ...base, previewUrl };
    }
  }
  if (kind === "audio" || kind === "video") {
    try {
      return { ...base, durationSeconds: await mediaDuration(file, kind) };
    } catch {
      return base;
    }
  }
  if (isTextFile(file)) {
    const text = await file.text();
    if (!text.includes("\u0000")) {
      return { ...base, text: text.slice(0, maxCharacters) };
    }
  }
  return base;
}

function kindFor(file: File): AttachmentKind {
  const type = file.type.toLowerCase();
  const extension = extensionOf(file.name);
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(extension)) {
    return "image";
  }
  if (type.startsWith("video/") || ["mp4", "webm", "mov", "mkv"].includes(extension)) {
    return "video";
  }
  if (type.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(extension)) {
    return "audio";
  }
  return "document";
}

function isTextFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type.startsWith("text/") || type === "application/json" || type === "application/javascript" || type === "application/xml") {
    return true;
  }
  return TEXT_EXTENSIONS.has(extensionOf(file.name));
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function imageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("The image could not be read."));
    image.src = url;
  });
}

function mediaDuration(file: File, kind: "audio" | "video"): Promise<number> {
  return new Promise((resolve, reject) => {
    const element = document.createElement(kind);
    const url = URL.createObjectURL(file);
    const finish = (duration: number | undefined): void => {
      URL.revokeObjectURL(url);
      if (duration !== undefined && Number.isFinite(duration)) {
        resolve(duration);
        return;
      }
      reject(new Error("The media duration could not be read."));
    };
    element.preload = "metadata";
    element.onloadedmetadata = () => finish(element.duration);
    element.onerror = () => finish(undefined);
    element.src = url;
  });
}
