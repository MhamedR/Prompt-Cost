import type { ProviderId } from "../types";

const SECRET_KEYS = {
  anthropic: "promptCost.apiKey.anthropic",
  gemini: "promptCost.apiKey.gemini",
} as const;

export type ApiProviderId = keyof typeof SECRET_KEYS;

export function apiProviderId(providerId: ProviderId): ApiProviderId | undefined {
  if (providerId === "anthropic" || providerId === "gemini") {
    return providerId;
  }
  return undefined;
}

export function secretKey(providerId: ApiProviderId): string {
  return SECRET_KEYS[providerId];
}
