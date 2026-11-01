import type { ApiProviderId } from "../secrets/apiKeys";

export interface ApiCount {
  count: number;
  summary: string;
}

const MODEL_ID = /^[A-Za-z0-9._-]+$/;

export async function countWithProviderApi(args: {
  providerId: ApiProviderId;
  modelId: string;
  text: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<ApiCount> {
  if (!MODEL_ID.test(args.modelId)) {
    throw new Error("The model id cannot be sent to the provider API.");
  }
  const fetchImpl = args.fetchImpl ?? fetch;
  if (args.providerId === "anthropic") {
    return countAnthropic(args.modelId, args.text, args.apiKey, fetchImpl);
  }
  return countGemini(args.modelId, args.text, args.apiKey, fetchImpl);
}

async function countAnthropic(modelId: string, text: string, apiKey: string, fetchImpl: typeof fetch): Promise<ApiCount> {
  const response = await fetchImpl("https://api.anthropic.com/v1/messages/count_tokens", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: text }],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(publicApiError(response.status, body, text));
  }
  const count = readCount(body, "input_tokens");
  return {
    count,
    summary: "Anthropic count_tokens for one user message. That includes a small amount of message framing and excludes tools, system text, and images you did not put in the editor.",
  };
}

async function countGemini(modelId: string, text: string, apiKey: string, fetchImpl: typeof fetch): Promise<ApiCount> {
  const endpoint = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:countTokens`);
  endpoint.searchParams.set("key", apiKey);
  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text }] }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new Error(networkError(error, apiKey));
  }
  const body = await response.text();
  if (!response.ok) {
    throw new Error(publicApiError(response.status, body, text));
  }
  const count = readCount(body, "totalTokens");
  return {
    count,
    summary: "Google countTokens for the text sent as one user turn. It does not include tools or files that were not in the editor text.",
  };
}

function readCount(body: string, field: "input_tokens" | "totalTokens"): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("The provider returned a token count the extension could not read.");
  }
  if (typeof parsed !== "object" || parsed === null || !(field in parsed)) {
    throw new Error("The provider returned a token count the extension could not read.");
  }
  const value = (parsed as Record<string, unknown>)[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("The provider returned a token count the extension could not read.");
  }
  return value;
}

export function publicApiError(status: number, body: string, prompt: string): string {
  const fallback = `The provider rejected the token count (HTTP ${status}).`;
  let message = "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } };
    message = typeof parsed.error?.message === "string" ? parsed.error.message : "";
  } catch {
    message = "";
  }
  if (message.length === 0 || message.length > 180) {
    return fallback;
  }
  const sample = prompt.slice(0, 40);
  if (sample.length >= 12 && message.includes(sample)) {
    return fallback;
  }
  return `${fallback} ${message}`;
}

export function networkError(error: unknown, apiKey: string): string {
  const raw = error instanceof Error ? error.message : "";
  if (raw.includes(apiKey) || raw.toLowerCase().includes("key=")) {
    return "The token-count request failed before a count was returned.";
  }
  return "The token-count request failed before a count was returned.";
}
