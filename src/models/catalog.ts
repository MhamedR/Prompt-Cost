import { ANTHROPIC_MODELS } from "./anthropic";
import { DEEPSEEK_MODELS } from "./deepseek";
import { GEMINI_MODELS } from "./gemini";
import { LLAMA_MODELS } from "./llama";
import { MISTRAL_MODELS } from "./mistral";
import { OPENAI_MODELS } from "./openai";
import type { ModelSpec, ProviderId } from "../types";

export const MODELS: ModelSpec[] = [
  ...OPENAI_MODELS,
  ...ANTHROPIC_MODELS,
  ...GEMINI_MODELS,
  ...LLAMA_MODELS,
  ...MISTRAL_MODELS,
  ...DEEPSEEK_MODELS,
];

const BY_ID = new Map(MODELS.map((model) => [model.id, model]));

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  llama: "Meta Llama",
  mistral: "Mistral",
  deepseek: "DeepSeek",
};

export function getModel(id: string): ModelSpec | undefined {
  return BY_ID.get(id);
}

export function modelsForProvider(providerId: ProviderId): ModelSpec[] {
  return MODELS.filter((model) => model.providerId === providerId);
}

export function defaultModelFor(providerId: ProviderId): ModelSpec {
  const models = modelsForProvider(providerId);
  const first = models[0];
  if (!first) {
    throw new Error(`Provider ${providerId} has no models.`);
  }
  return first;
}
