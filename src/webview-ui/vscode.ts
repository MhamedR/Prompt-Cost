import type { HostToWebview, WebviewToHost } from "../webview/protocol";

interface VsCodeApi {
  postMessage(message: WebviewToHost): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

export const vscodeApi = acquireVsCodeApi();

export function isHostMessage(value: unknown): value is HostToWebview {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }
  const type = (value as { type: unknown }).type;
  return type === "snapshot" || type === "comparison" || type === "promptText";
}
