export const PROVIDER_IDS = [
  "openai",
  "anthropic",
  "gemini",
  "llama",
  "mistral",
  "deepseek",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type TokenAccuracy = "exact-local" | "provider-api" | "approximate";

export interface PriceTier {
  maxInputTokens?: number;
  inputPerMillion: number;
  outputPerMillion: number;
}

export type PricingKind = "official" | "unpriced";

export interface ModelPricing {
  kind: PricingKind;
  currency: "USD";
  asOf: string;
  source: string;
  sourceUrl: string;
  notes: string;
  tiers: PriceTier[];
}

export interface ModelSpec {
  id: string;
  label: string;
  providerId: ProviderId;
  contextWindow?: number;
  tokenizer: string;
  accuracy: TokenAccuracy;
  accuracyDetail: string;
  compatibility: string;
  pricing: ModelPricing;
  apiModelId?: string;
  supportsApiCount: boolean;
  warnings?: string[];
}

export interface TokenCountResult {
  count: number;
  accuracy: TokenAccuracy;
  tokenizer: string;
  summary: string;
  warnings: string[];
}

export interface TokenizerProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  countTokens(text: string, model: string): Promise<TokenCountResult>;
}

export interface PriceOverride {
  inputPerMillion: number;
  outputPerMillion: number;
}

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}
