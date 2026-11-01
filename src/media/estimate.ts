import type { ProviderId } from "../types";

export type AttachmentKind = "document" | "image" | "video" | "audio";

export interface AttachmentPayload {
  id: string;
  name: string;
  kind: AttachmentKind;
  bytes: number;
  text?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface MediaEstimate {
  tokens: number;
  warnings: string[];
}

const MAX_ATTACHMENTS = 8;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const PAGE_BYTES = 100_000;
const PATCH = 32;

const HIGH_RESOLUTION_CLAUDE = new Set([
  "claude-opus-5-5",
  "claude-sonnet-5-5",
  "claude-haiku-5-5",
  "claude-fable-5",
  "claude-opus-4-7",
]);

export function textForCounting(prompt: string, attachments: readonly AttachmentPayload[]): string {
  const parts: string[] = [];
  if (prompt.length > 0) {
    parts.push(prompt);
  }
  for (const attachment of attachments) {
    if (attachment.kind === "document" && attachment.text && attachment.text.length > 0) {
      parts.push(attachment.text);
    }
  }
  return parts.join("\n\n");
}

export function attachmentKey(attachments: readonly AttachmentPayload[]): string {
  return attachments
    .map((attachment) =>
      [
        attachment.kind,
        attachment.bytes,
        attachment.width ?? "",
        attachment.height ?? "",
        attachment.durationSeconds ?? "",
        hashText(attachment.text ?? ""),
        attachment.name,
      ].join(":"),
    )
    .join("|");
}

export function sanitizeAttachments(value: unknown, maxCharacters: number): AttachmentPayload[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const attachments: AttachmentPayload[] = [];
  for (const item of value) {
    if (attachments.length >= MAX_ATTACHMENTS) {
      break;
    }
    const parsed = parseAttachment(item, maxCharacters);
    if (parsed) {
      attachments.push(parsed);
    }
  }
  return attachments;
}

export function estimateAttachments(args: {
  providerId: ProviderId;
  modelId: string;
  attachments: readonly AttachmentPayload[];
}): MediaEstimate {
  const warnings: string[] = [];
  let tokens = 0;
  for (const attachment of args.attachments) {
    const estimate = estimateOne(args.providerId, args.modelId, attachment);
    tokens += estimate.tokens;
    warnings.push(...estimate.warnings);
  }
  if (tokens > 0) {
    warnings.push("Attached files are priced at the model's text input rate. Some providers bill images, audio, or video on a separate rate.");
  }
  return { tokens, warnings };
}

export function openaiImageTokens(modelId: string, width: number, height: number): number {
  const mode = openaiImageMode(modelId);
  if (mode.kind === "tile") {
    return tileTokens(width, height, mode.base, mode.tile);
  }
  const fitted = fitLongestEdge(width, height, mode.maxEdge);
  const sized = mode.patchBudget === null ? fitted : shrinkToPatchBudget(fitted.width, fitted.height, mode.patchBudget);
  const patches = Math.min(patchCount(sized.width, sized.height), 30_000);
  return Math.ceil(patches * mode.multiplier);
}

export function claudeImageTokens(modelId: string, width: number, height: number): number {
  const highResolution = HIGH_RESOLUTION_CLAUDE.has(modelId);
  const [resizedWidth, resizedHeight] = claudeResizedSize(
    width,
    height,
    highResolution ? 2576 : 1568,
    highResolution ? 4784 : 1568,
  );
  return Math.ceil(resizedWidth / 28) * Math.ceil(resizedHeight / 28);
}

function estimateOne(providerId: ProviderId, modelId: string, attachment: AttachmentPayload): MediaEstimate {
  const name = safeName(attachment.name);
  switch (attachment.kind) {
    case "document":
      return attachment.text && attachment.text.length > 0
        ? { tokens: 0, warnings: [] }
        : estimateBinaryDocument(providerId, modelId, attachment, name);
    case "image":
      return estimateImage(providerId, modelId, attachment, name);
    case "audio":
      return estimateTimed(providerId, modelId, attachment, name, "audio");
    case "video":
      return estimateTimed(providerId, modelId, attachment, name, "video");
  }
}

function estimateImage(
  providerId: ProviderId,
  modelId: string,
  attachment: AttachmentPayload,
  name: string,
): MediaEstimate {
  const width = attachment.width;
  const height = attachment.height;
  if (!width || !height) {
    return { tokens: 0, warnings: [`${name} has no readable image size, so it was not counted.`] };
  }
  if (providerId === "openai") {
    const tokens = openaiImageTokens(modelId, width, height);
    const warnings = [
      `${name} uses OpenAI's image sizing rules for ${modelId}. Billing can differ by about one token.`,
    ];
    if (patchCount(width, height) > 30_000 && openaiImageMode(modelId).kind === "patch") {
      warnings.push(`${name} may be rejected: OpenAI allows 30,000 patches after resizing.`);
    }
    return { tokens, warnings };
  }
  if (providerId === "anthropic") {
    return {
      tokens: claudeImageTokens(modelId, width, height),
      warnings: [`${name} uses Claude's 28×28 image patches and the model's resolution limit.`],
    };
  }
  if (providerId === "gemini") {
    const tokens = modelId.startsWith("gemini-3") ? 1120 : gemini25ImageTokens(width, height);
    const detail = modelId.startsWith("gemini-3")
      ? "Gemini 3's default image budget is 1,120 tokens."
      : "Gemini 2.5 counts a small image as 258 tokens and larger images as 768px tiles.";
    return { tokens, warnings: [`${name}: ${detail}`] };
  }
  return {
    tokens: 768,
    warnings: [`${name} has no published image tokenizer for this provider. It is counted as 768 tokens.`],
  };
}

function estimateTimed(
  providerId: ProviderId,
  modelId: string,
  attachment: AttachmentPayload,
  name: string,
  kind: "audio" | "video",
): MediaEstimate {
  const measured = attachment.durationSeconds;
  const seconds = measured !== undefined && measured > 0 ? measured : assumedSeconds(kind, attachment.bytes);
  const durationWarning =
    measured !== undefined && measured > 0
      ? []
      : [`${name} has no readable duration. The length is estimated from the file size.`];
  if (kind === "audio") {
    const published = audioRate(providerId, modelId);
    return {
      tokens: Math.ceil(seconds * published.rate),
      warnings: [
        ...durationWarning,
        published.published
          ? `${name} uses ${published.rate} audio tokens per second.`
          : `${name} has no published audio rate for this model. It is counted at ${published.rate} tokens per second.`,
      ],
    };
  }
  if (providerId === "openai") {
    const perFrame = openaiImageTokens(modelId, 1280, 720);
    return {
      tokens: Math.ceil(seconds) * perFrame,
      warnings: [
        ...durationWarning,
        `${name} has no published video-file rate. Each second is counted as one 1280×720 frame.`,
      ],
    };
  }
  const published = videoRate(providerId, modelId);
  return {
    tokens: Math.ceil(seconds * published.rate),
    warnings: [
      ...durationWarning,
      published.published
        ? `${name} uses about ${published.rate} video tokens per second, including audio at the default resolution.`
        : `${name} has no published video rate for this model. It is counted at ${published.rate} tokens per second.`,
    ],
  };
}

function estimateBinaryDocument(
  providerId: ProviderId,
  modelId: string,
  attachment: AttachmentPayload,
  name: string,
): MediaEstimate {
  const pages = Math.max(1, Math.round(attachment.bytes / PAGE_BYTES));
  const pageNote = `${name} was not parsed. About ${pages} page${pages === 1 ? "" : "s"} are assumed from the file size.`;
  if (providerId === "openai") {
    return {
      tokens: pages * openaiImageTokens(modelId, 1700, 2200),
      warnings: [`${pageNote} Each page uses the model's image rules at 1700×2200.`],
    };
  }
  if (providerId === "anthropic") {
    return {
      tokens: pages * 1568,
      warnings: [`${pageNote} Each page is counted at Claude's standard 1,568 visual-token cap. Claude 4.7 and later can use more on a dense page.`],
    };
  }
  if (providerId === "gemini") {
    const perPage = modelId.startsWith("gemini-3") ? 560 : 256;
    return {
      tokens: pages * perPage,
      warnings: [`${pageNote} Gemini's default PDF budget is ${perPage} tokens per page, before extracted text.`],
    };
  }
  return {
    tokens: pages * 500,
    warnings: [`${pageNote} This provider has no published document-file rate, so each page is counted as 500 tokens.`],
  };
}

function audioRate(providerId: ProviderId, modelId: string): { rate: number; published: boolean } {
  if (providerId === "gemini") {
    return { rate: modelId.startsWith("gemini-3") ? 25 : 32, published: true };
  }
  if (providerId === "openai") {
    return { rate: 10, published: false };
  }
  return { rate: 25, published: false };
}

function videoRate(providerId: ProviderId, modelId: string): { rate: number; published: boolean } {
  if (providerId === "gemini") {
    return { rate: modelId.startsWith("gemini-3") ? 100 : 263, published: true };
  }
  return { rate: 100, published: false };
}

function gemini25ImageTokens(width: number, height: number): number {
  if (width <= 384 && height <= 384) {
    return 258;
  }
  return Math.ceil(width / 768) * Math.ceil(height / 768) * 258;
}

function openaiImageMode(modelId: string):
  | { kind: "patch"; maxEdge: number; patchBudget: number | null; multiplier: number }
  | { kind: "tile"; base: number; tile: number } {
  switch (modelId) {
    case "gpt-5.6-sol":
    case "gpt-5.6-terra":
    case "gpt-5.6-luna":
      return { kind: "patch", maxEdge: 65_535, patchBudget: null, multiplier: 1.2 };
    case "gpt-5.4":
    case "gpt-5.4-mini":
    case "gpt-5.4-nano":
      return { kind: "patch", maxEdge: 2048, patchBudget: 2500, multiplier: 1.2 };
    case "gpt-4.1-mini":
      return { kind: "patch", maxEdge: 2048, patchBudget: 6144, multiplier: 1.62 };
    case "o4-mini":
      return { kind: "patch", maxEdge: 2048, patchBudget: 1536, multiplier: 1.72 };
    case "gpt-5-mini":
      return { kind: "patch", maxEdge: 2048, patchBudget: 1536, multiplier: 1.2 };
    case "gpt-4o-mini":
      return { kind: "tile", base: 2833, tile: 5667 };
    case "o3":
      return { kind: "tile", base: 75, tile: 150 };
    default:
      return { kind: "tile", base: 85, tile: 170 };
  }
}

function tileTokens(width: number, height: number, base: number, tile: number): number {
  let sized = fitLongestEdge(width, height, 2048);
  const shortest = Math.min(sized.width, sized.height);
  if (shortest > 768) {
    const scale = 768 / shortest;
    sized = {
      width: Math.max(1, Math.floor(sized.width * scale)),
      height: Math.max(1, Math.floor(sized.height * scale)),
    };
  }
  const tiles = Math.ceil(sized.width / 512) * Math.ceil(sized.height / 512);
  return base + tiles * tile;
}

function fitLongestEdge(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function shrinkToPatchBudget(width: number, height: number, budget: number): { width: number; height: number } {
  if (patchCount(width, height) <= budget) {
    return { width, height };
  }
  const shrink = Math.sqrt((PATCH * PATCH * budget) / (width * height));
  const scaledWidth = width * shrink;
  const scaledHeight = height * shrink;
  const widthAlign = scaledWidth === 0 ? 1 : Math.floor(scaledWidth / PATCH) / (scaledWidth / PATCH);
  const heightAlign = scaledHeight === 0 ? 1 : Math.floor(scaledHeight / PATCH) / (scaledHeight / PATCH);
  const adjusted = shrink * Math.min(widthAlign, heightAlign);
  return {
    width: Math.max(1, Math.floor(width * adjusted)),
    height: Math.max(1, Math.floor(height * adjusted)),
  };
}

function patchCount(width: number, height: number): number {
  return Math.ceil(width / PATCH) * Math.ceil(height / PATCH);
}

function claudeResizedSize(width: number, height: number, maxEdge: number, maxTokens: number): [number, number] {
  const fits = (nextWidth: number, nextHeight: number): boolean =>
    Math.ceil(nextWidth / 28) * 28 <= maxEdge &&
    Math.ceil(nextHeight / 28) * 28 <= maxEdge &&
    Math.ceil(nextWidth / 28) * Math.ceil(nextHeight / 28) <= maxTokens;
  if (fits(width, height)) {
    return [width, height];
  }
  if (height > width) {
    const [resizedHeight, resizedWidth] = claudeResizedSize(height, width, maxEdge, maxTokens);
    return [resizedWidth, resizedHeight];
  }
  const aspectRatio = width / height;
  let lo = 1;
  let hi = width;
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid, Math.max(roundTiesToEven(mid / aspectRatio), 1))) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return [lo, Math.max(roundTiesToEven(lo / aspectRatio), 1)];
}

function roundTiesToEven(value: number): number {
  const floor = Math.floor(value);
  if (value - floor !== 0.5) {
    return Math.round(value);
  }
  return floor % 2 === 0 ? floor : floor + 1;
}

function assumedSeconds(kind: "audio" | "video", bytes: number): number {
  const bytesPerSecond = kind === "audio" ? 16_000 : 125_000;
  return Math.max(1, bytes / bytesPerSecond);
}

function parseAttachment(value: unknown, maxCharacters: number): AttachmentPayload | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  if (kind !== "document" && kind !== "image" && kind !== "video" && kind !== "audio") {
    return undefined;
  }
  if (typeof record.id !== "string" || typeof record.name !== "string") {
    return undefined;
  }
  const bytes = finiteNumber(record.bytes);
  if (bytes === undefined || bytes < 0 || bytes > MAX_FILE_BYTES) {
    return undefined;
  }
  const text = typeof record.text === "string" ? record.text.slice(0, maxCharacters) : undefined;
  const width = positiveInt(record.width);
  const height = positiveInt(record.height);
  const durationSeconds = finiteNumber(record.durationSeconds);
  return {
    id: record.id.slice(0, 80),
    name: safeName(record.name),
    kind,
    bytes,
    ...(text !== undefined && text.length > 0 ? { text } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(durationSeconds !== undefined && durationSeconds >= 0 && durationSeconds <= 86_400 ? { durationSeconds } : {}),
  };
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function positiveInt(value: unknown): number | undefined {
  const number = finiteNumber(value);
  if (number === undefined || number < 1 || number > 100_000) {
    return undefined;
  }
  return Math.round(number);
}

function safeName(name: string): string {
  const cleaned = name.replace(/[\r\n]/g, " ").trim();
  return (cleaned.length > 0 ? cleaned : "attachment").slice(0, 180);
}

function hashText(text: string): number {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (Math.imul(hash, 31) + text.charCodeAt(index)) | 0;
  }
  return hash;
}
