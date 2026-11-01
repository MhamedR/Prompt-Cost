import { officialPrice } from "./price";
import type { ModelSpec } from "../types";

const SOURCE = "Gemini Developer API pricing";
const SOURCE_URL = "https://ai.google.dev/gemini-api/docs/pricing";
const AS_OF = "2026-10-30";

const LOCAL =
  "Approximate local estimate. Google does not publish a small tokenizer this extension can bundle. countTokens is the authoritative count and runs only after you confirm a send.";

const PROMO =
  "Standard paid text rate in USD per 1M tokens, including the promotional rate in effect on 1 November 2026. Thinking tokens are billed as output and are not estimated. Audio, image, video, cache, and grounding fees are not applied.";

function model(spec: Omit<ModelSpec, "providerId" | "accuracy" | "accuracyDetail" | "tokenizer" | "supportsApiCount">): ModelSpec {
  return {
    providerId: "gemini",
    tokenizer: "gemini-local-estimate",
    accuracy: "approximate",
    accuracyDetail: LOCAL,
    supportsApiCount: true,
    ...spec,
  };
}

export const GEMINI_MODELS: ModelSpec[] = [
  model({
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    apiModelId: "gemini-3.8-flash",
    contextWindow: 1_048_576,
    compatibility: "Script-aware local estimate, not Google's SentencePiece model. The published Gemini 3 input budget is 1,048,576 tokens.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: `${PROMO} The listed standard rate rises from $0.75 / $3.75 to $1.50 / $7.50 on 1 January 2027.`,
      tiers: [{ inputPerMillion: 0.75, outputPerMillion: 3.75 }],
    }),
  }),
  model({
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    apiModelId: "gemini-3.6-flash",
    contextWindow: 1_048_576,
    compatibility: "Script-aware local estimate, not Google's SentencePiece model.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: `${PROMO} The listed standard rate rises from $0.75 / $3.75 to $1.50 / $7.50 on 1 January 2027.`,
      tiers: [{ inputPerMillion: 0.75, outputPerMillion: 3.75 }],
    }),
  }),
  model({
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    apiModelId: "gemini-3.1-pro-preview",
    contextWindow: 1_048_576,
    compatibility: "Script-aware local estimate. The price tier changes at 200,000 prompt tokens.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes:
        "Standard paid text rate. The higher tier applies when the analyzed text exceeds 200,000 tokens. Thinking tokens are billed as output and are not estimated.",
      tiers: [
        { maxInputTokens: 200_000, inputPerMillion: 2, outputPerMillion: 12 },
        { inputPerMillion: 4, outputPerMillion: 18 },
      ],
    }),
  }),
  model({
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    apiModelId: "gemini-3-flash-preview",
    contextWindow: 1_048_576,
    compatibility: "Script-aware local estimate for text. Audio is priced separately and is not detected.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: "Standard text rate in USD per 1M tokens. Audio input is $1 and is not applied. Thinking tokens are billed as output.",
      tiers: [{ inputPerMillion: 0.5, outputPerMillion: 3 }],
    }),
  }),
  model({
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    apiModelId: "gemini-2.5-pro",
    contextWindow: 1_048_576,
    compatibility: "Script-aware local estimate. The price tier changes at 200,000 prompt tokens.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes:
        "Standard paid text rate. The higher tier applies when the analyzed text exceeds 200,000 tokens. Thinking tokens are billed as output and are not estimated.",
      tiers: [
        { maxInputTokens: 200_000, inputPerMillion: 1.25, outputPerMillion: 10 },
        { inputPerMillion: 2.5, outputPerMillion: 15 },
      ],
    }),
  }),
  model({
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    apiModelId: "gemini-2.5-flash",
    contextWindow: 1_048_576,
    compatibility: "Script-aware local estimate. The model page documents a 1,048,576 token input budget.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: "Standard text, image, and video input rate. Audio input is $1 and is not applied. Thinking tokens are billed as output.",
      tiers: [{ inputPerMillion: 0.3, outputPerMillion: 2.5 }],
    }),
  }),
  model({
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    apiModelId: "gemini-2.5-flash-lite",
    contextWindow: 1_048_576,
    compatibility: "Script-aware local estimate for text.",
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: "Standard text, image, and video input rate. Audio input is $0.30 and is not applied.",
      tiers: [{ inputPerMillion: 0.1, outputPerMillion: 0.4 }],
    }),
  }),
];

const BY_ID = new Map(GEMINI_MODELS.map((entry) => [entry.id, entry]));

export function geminiModel(id: string): ModelSpec | undefined {
  return BY_ID.get(id);
}
