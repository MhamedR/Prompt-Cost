import { officialPrice } from "./price";
import type { ModelSpec } from "../types";

const SOURCE = "OpenAI API pricing";
const SOURCE_URL = "https://developers.openai.com/api/docs/pricing";
const AS_OF = "2026-10-05";

const SHORT_CONTEXT =
  "Short-context list price in USD per 1M tokens. Cached input, batch, and long-context rates are not applied. Image and audio tokens are not estimated.";

const EXACT =
  "Exact count of the raw text with the OpenAI encoding shipped for this model in gpt-tokenizer (a tiktoken port). Chat framing, tools, images, and audio are not included.";

function model(
  spec: Omit<ModelSpec, "providerId" | "supportsApiCount" | "accuracy" | "accuracyDetail"> & {
    accuracyDetail?: string;
  },
): ModelSpec {
  return {
    providerId: "openai",
    supportsApiCount: false,
    accuracy: "exact-local",
    accuracyDetail: spec.accuracyDetail ?? EXACT,
    ...spec,
  };
}

export const OPENAI_MODELS: ModelSpec[] = [
  model({
    id: "gpt-5.6-sol",
    label: "GPT-5.6 Sol",
    contextWindow: 1_050_000,
    tokenizer: "o200k_base",
    compatibility: "gpt-tokenizer maps gpt-5.6-sol to o200k_base.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: SHORT_CONTEXT,
      tiers: [{ inputPerMillion: 4, outputPerMillion: 20 }],
    }),
  }),
  model({
    id: "gpt-5.6-terra",
    label: "GPT-5.6 Terra",
    contextWindow: 1_050_000,
    tokenizer: "o200k_base",
    compatibility: "gpt-tokenizer maps gpt-5.6-terra to o200k_base.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: SHORT_CONTEXT,
      tiers: [{ inputPerMillion: 2, outputPerMillion: 12 }],
    }),
  }),
  model({
    id: "gpt-5.6-luna",
    label: "GPT-5.6 Luna",
    contextWindow: 1_050_000,
    tokenizer: "o200k_base",
    compatibility: "gpt-tokenizer maps gpt-5.6-luna to o200k_base.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: SHORT_CONTEXT,
      tiers: [{ inputPerMillion: 0.2, outputPerMillion: 1.2 }],
    }),
  }),
  model({
    id: "gpt-5.4",
    label: "GPT-5.4",
    contextWindow: 1_050_000,
    tokenizer: "o200k_base",
    compatibility: "gpt-tokenizer maps gpt-5.4 to o200k_base.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes:
        "List price in USD per 1M tokens. The higher tier applies when the analyzed text itself exceeds 272,000 tokens. OpenAI's threshold is the full context, which may include messages this extension cannot see. Cache and batch rates are not applied.",
      tiers: [
        { maxInputTokens: 272_000, inputPerMillion: 2.5, outputPerMillion: 15 },
        { inputPerMillion: 5, outputPerMillion: 22.5 },
      ],
    }),
  }),
  model({
    id: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    contextWindow: 400_000,
    tokenizer: "o200k_base",
    compatibility: "gpt-tokenizer maps gpt-5.4-mini to o200k_base.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: SHORT_CONTEXT,
      tiers: [{ inputPerMillion: 0.75, outputPerMillion: 4.5 }],
    }),
  }),
  model({
    id: "gpt-5",
    label: "GPT-5",
    contextWindow: 400_000,
    tokenizer: "o200k_base",
    compatibility: "gpt-tokenizer maps gpt-5 to o200k_base.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: SHORT_CONTEXT,
      tiers: [{ inputPerMillion: 1.25, outputPerMillion: 10 }],
    }),
  }),
  model({
    id: "gpt-5-mini",
    label: "GPT-5 mini",
    contextWindow: 400_000,
    tokenizer: "o200k_base",
    compatibility: "gpt-tokenizer maps gpt-5-mini to o200k_base.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: SHORT_CONTEXT,
      tiers: [{ inputPerMillion: 0.25, outputPerMillion: 2 }],
    }),
  }),
  model({
    id: "gpt-4.1",
    label: "GPT-4.1",
    contextWindow: 1_047_576,
    tokenizer: "o200k_base",
    compatibility: "gpt-tokenizer maps gpt-4.1 to o200k_base.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: SHORT_CONTEXT,
      tiers: [{ inputPerMillion: 2, outputPerMillion: 8 }],
    }),
  }),
  model({
    id: "gpt-4o",
    label: "GPT-4o",
    contextWindow: 128_000,
    tokenizer: "o200k_base",
    compatibility: "gpt-tokenizer maps gpt-4o to o200k_base.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: SHORT_CONTEXT,
      tiers: [{ inputPerMillion: 2.5, outputPerMillion: 10 }],
    }),
  }),
  model({
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    contextWindow: 128_000,
    tokenizer: "o200k_base",
    compatibility: "gpt-tokenizer maps gpt-4o-mini to o200k_base.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: SHORT_CONTEXT,
      tiers: [{ inputPerMillion: 0.15, outputPerMillion: 0.6 }],
    }),
  }),
  model({
    id: "o3",
    label: "o3",
    contextWindow: 200_000,
    tokenizer: "o200k_base",
    compatibility: "gpt-tokenizer maps o3 to o200k_base. Reasoning tokens billed as output are not estimated.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: `${SHORT_CONTEXT} Reasoning tokens are billed as output and are not part of the output box unless you type them in.`,
      tiers: [{ inputPerMillion: 2, outputPerMillion: 8 }],
    }),
  }),
  model({
    id: "o4-mini",
    label: "o4-mini",
    contextWindow: 200_000,
    tokenizer: "o200k_base",
    compatibility: "gpt-tokenizer maps o4-mini to o200k_base. Reasoning tokens billed as output are not estimated.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: `${SHORT_CONTEXT} Reasoning tokens are billed as output and are not part of the output box unless you type them in.`,
      tiers: [{ inputPerMillion: 1.1, outputPerMillion: 4.4 }],
    }),
  }),
  model({
    id: "gpt-4-turbo",
    label: "GPT-4 Turbo",
    contextWindow: 128_000,
    tokenizer: "cl100k_base",
    compatibility: "gpt-tokenizer maps gpt-4-turbo to cl100k_base, not o200k_base.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: "List price for gpt-4-turbo-2024-04-09 in USD per 1M tokens.",
      tiers: [{ inputPerMillion: 10, outputPerMillion: 30 }],
    }),
  }),
  model({
    id: "gpt-3.5-turbo",
    label: "GPT-3.5 Turbo",
    contextWindow: 16_385,
    tokenizer: "cl100k_base",
    compatibility: "gpt-tokenizer maps gpt-3.5-turbo to cl100k_base.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: "List price for gpt-3.5-turbo in USD per 1M tokens.",
      tiers: [{ inputPerMillion: 0.5, outputPerMillion: 1.5 }],
    }),
  }),
];

const BY_ID = new Map(OPENAI_MODELS.map((entry) => [entry.id, entry]));

export function openAiModel(id: string): ModelSpec | undefined {
  return BY_ID.get(id);
}
