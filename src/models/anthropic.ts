import { officialPrice } from "./price";
import type { ModelSpec } from "../types";

const SOURCE = "Anthropic Claude API pricing";
const SOURCE_URL = "https://platform.claude.com/docs/en/about-claude/pricing";
const AS_OF = "2026-10-07";

const LOCAL =
  "Approximate local count with the Claude encoding in ai-tokenizer. Anthropic's @anthropic-ai/tokenizer package does not match Claude 3 or later and is not used. The count_tokens API is authoritative and is not called unless you explicitly send the text.";

const NEWER =
  "Anthropic says Claude 4.7 and later, including Fable, use a newer tokenizer that produces about 30% more tokens than earlier models. The difference depends on the text. This local encoding can under-count those models.";

function model(spec: Omit<ModelSpec, "providerId" | "accuracy" | "accuracyDetail" | "supportsApiCount">): ModelSpec {
  return {
    providerId: "anthropic",
    accuracy: "approximate",
    accuracyDetail: LOCAL,
    supportsApiCount: true,
    ...spec,
  };
}

export const ANTHROPIC_MODELS: ModelSpec[] = [
  model({
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    apiModelId: "claude-opus-5-5",
    tokenizer: "claude",
    compatibility: "Local Claude encoding from ai-tokenizer. Opus 5.5 is in the newer tokenizer generation.",
    warnings: [NEWER],
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: "Global standard list price in USD per 1M tokens. Cache writes and cache hits are not applied.",
      tiers: [{ inputPerMillion: 4, outputPerMillion: 20 }],
    }),
  }),
  model({
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    apiModelId: "claude-sonnet-5-5",
    tokenizer: "claude",
    compatibility: "Local Claude encoding from ai-tokenizer. Sonnet 5.5 is in the newer tokenizer generation.",
    warnings: [NEWER],
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: "Global standard list price in USD per 1M tokens. Cache writes and cache hits are not applied.",
      tiers: [{ inputPerMillion: 2, outputPerMillion: 10 }],
    }),
  }),
  model({
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    apiModelId: "claude-haiku-5-5",
    tokenizer: "claude",
    compatibility: "Local Claude encoding from ai-tokenizer. Haiku 5.5 is in the newer tokenizer generation. The price tier changes at 100,000 input tokens.",
    warnings: [NEWER],
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes:
        "Global standard list price. The higher tier applies when the analyzed text exceeds 100,000 tokens. Cache writes and cache hits are not applied.",
      tiers: [
        { maxInputTokens: 100_000, inputPerMillion: 0.1, outputPerMillion: 0.5 },
        { inputPerMillion: 0.5, outputPerMillion: 2.5 },
      ],
    }),
  }),
  model({
    id: "claude-fable-5",
    label: "Claude Fable 5",
    apiModelId: "claude-fable-5",
    tokenizer: "claude",
    compatibility: "Local Claude encoding from ai-tokenizer. Fable uses the newer tokenizer generation.",
    warnings: [NEWER],
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: "Global standard list price in USD per 1M tokens. Cache writes and cache hits are not applied.",
      tiers: [{ inputPerMillion: 10, outputPerMillion: 50 }],
    }),
  }),
  model({
    id: "claude-opus-4-7",
    label: "Claude Opus 4.7",
    apiModelId: "claude-opus-4-7",
    tokenizer: "claude",
    compatibility: "Local Claude encoding from ai-tokenizer. Opus 4.7 is the start of the newer tokenizer generation.",
    warnings: [NEWER],
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: "Global standard list price in USD per 1M tokens. Cache writes and cache hits are not applied.",
      tiers: [{ inputPerMillion: 5, outputPerMillion: 25 }],
    }),
  }),
  model({
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    apiModelId: "claude-sonnet-4-6",
    tokenizer: "claude",
    compatibility:
      "Local Claude encoding from ai-tokenizer. Sonnet 4.6 is before the Claude 4.7 tokenizer change. Published checks of this encoding sit near the API on Claude 4.5-class text, and they are still not an official count.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: "Global standard list price in USD per 1M tokens. Cache writes and cache hits are not applied.",
      tiers: [{ inputPerMillion: 3, outputPerMillion: 15 }],
    }),
  }),
  model({
    id: "claude-opus-4-5",
    label: "Claude Opus 4.5",
    apiModelId: "claude-opus-4-5",
    tokenizer: "claude",
    compatibility:
      "Local Claude encoding from ai-tokenizer. ai-tokenizer's published check for claude-opus-4.5 was about 99% of the API count on a 50k-token sample. That is not a guarantee for your text.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: "Global standard list price in USD per 1M tokens. Cache writes and cache hits are not applied.",
      tiers: [{ inputPerMillion: 5, outputPerMillion: 25 }],
    }),
  }),
  model({
    id: "claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    apiModelId: "claude-sonnet-4-5",
    tokenizer: "claude",
    compatibility:
      "Local Claude encoding from ai-tokenizer. The published check for Claude Sonnet 4.5 was about 99% of the API count on a long sample. Message framing is still excluded.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: "Global standard list price in USD per 1M tokens. Cache writes and cache hits are not applied.",
      tiers: [{ inputPerMillion: 3, outputPerMillion: 15 }],
    }),
  }),
  model({
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    apiModelId: "claude-haiku-4-5",
    tokenizer: "claude",
    compatibility: "Local Claude encoding from ai-tokenizer. Haiku 4.5 is before the Claude 4.7 tokenizer change.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: "Global standard list price in USD per 1M tokens. Cache writes and cache hits are not applied.",
      tiers: [{ inputPerMillion: 1, outputPerMillion: 5 }],
    }),
  }),
];

const BY_ID = new Map(ANTHROPIC_MODELS.map((entry) => [entry.id, entry]));

export function anthropicModel(id: string): ModelSpec | undefined {
  return BY_ID.get(id);
}
