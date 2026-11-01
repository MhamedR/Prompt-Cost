import { officialPrice, unpriced } from "./price";
import type { ModelSpec } from "../types";

const SOURCE = "Mistral API pricing";
const SOURCE_URL = "https://docs.mistral.ai/inference/pricing";
const AS_OF = "2026-11-01";

const EXACT =
  "Exact count of the raw text with the tokenizer mistral-tokenizer-ts selects for this model. BOS, EOS, and the chat template are not included.";

const APPROXIMATE =
  "Approximate. mistral-tokenizer-ts does not ship this model's vocabulary. The count uses the closest tokenizer that package does ship, named in the compatibility line.";

interface MistralExtra {
  libraryModel: string;
}

export type MistralModelSpec = ModelSpec & MistralExtra;

function priced(input: number, output: number, notes: string) {
  return officialPrice({
    asOf: AS_OF,
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    notes,
    tiers: [{ inputPerMillion: input, outputPerMillion: output }],
  });
}

export const MISTRAL_MODELS: MistralModelSpec[] = [
  {
    id: "mistral-large-4",
    label: "Mistral Large 4",
    providerId: "mistral",
    tokenizer: "mistral-large-2407",
    accuracy: "approximate",
    accuracyDetail: APPROXIMATE,
    compatibility:
      "Counted with the mistral-large-2407 tokenizer from mistral-tokenizer-ts. Large 4 is not in that package, so this is not its official vocabulary.",
    supportsApiCount: false,
    libraryModel: "mistral-large-2407",
    pricing: priced(0.7, 2.1, "List price in USD per 1M tokens. Cached input is not applied."),
  },
  {
    id: "mistral-small-4",
    label: "Mistral Small 4",
    providerId: "mistral",
    tokenizer: "mistral-small-2402",
    accuracy: "approximate",
    accuracyDetail: APPROXIMATE,
    compatibility:
      "Counted with the mistral-small-2402 tokenizer from mistral-tokenizer-ts. Small 4 is not in that package.",
    supportsApiCount: false,
    libraryModel: "mistral-small-2402",
    pricing: priced(0.15, 0.6, "List price in USD per 1M tokens. Cached input is not applied."),
  },
  {
    id: "codestral",
    label: "Codestral",
    providerId: "mistral",
    tokenizer: "codestral-2405",
    accuracy: "approximate",
    accuracyDetail: APPROXIMATE,
    compatibility:
      "Counted with the codestral-2405 tokenizer. The current Codestral API model is newer than the vocabulary in mistral-tokenizer-ts.",
    supportsApiCount: false,
    libraryModel: "codestral-2405",
    pricing: priced(0.3, 0.9, "List price in USD per 1M tokens. Cached input is not applied."),
  },
  {
    id: "mistral-large-2407",
    label: "Mistral Large 2 (2407)",
    providerId: "mistral",
    tokenizer: "mistral-large-2407",
    accuracy: "exact-local",
    accuracyDetail: EXACT,
    compatibility: "mistral-tokenizer-ts vocabulary for mistral-large-2407.",
    supportsApiCount: false,
    libraryModel: "mistral-large-2407",
    pricing: unpriced("Retired from the current Mistral price card. Enter a host rate if you still serve it."),
  },
  {
    id: "codestral-2405",
    label: "Codestral 2405",
    providerId: "mistral",
    tokenizer: "codestral-2405",
    accuracy: "exact-local",
    accuracyDetail: EXACT,
    compatibility: "mistral-tokenizer-ts vocabulary for codestral-2405.",
    supportsApiCount: false,
    libraryModel: "codestral-2405",
    pricing: unpriced("Retired from the current Mistral price card. Enter a host rate if you still serve it."),
  },
  {
    id: "open-mistral-nemo",
    label: "Mistral Nemo",
    providerId: "mistral",
    tokenizer: "open-mistral-nemo",
    accuracy: "exact-local",
    accuracyDetail: EXACT,
    compatibility: "Tekken vocabulary selected by mistral-tokenizer-ts for open-mistral-nemo. It is not the v1 or v3 BPE used by older Mistral models.",
    supportsApiCount: false,
    libraryModel: "open-mistral-nemo",
    pricing: unpriced("Open-weight host pricing is not a Mistral API list price. Enter the rate you pay."),
  },
  {
    id: "open-mistral-7b",
    label: "Mistral 7B",
    providerId: "mistral",
    tokenizer: "open-mistral-7b",
    accuracy: "exact-local",
    accuracyDetail: EXACT,
    compatibility: "mistral-tokenizer-ts vocabulary for the open-mistral-7b alias.",
    supportsApiCount: false,
    libraryModel: "open-mistral-7b",
    pricing: unpriced("Open-weight host pricing is not a Mistral API list price. Enter the rate you pay."),
  },
  {
    id: "open-mixtral-8x7b",
    label: "Mixtral 8x7B",
    providerId: "mistral",
    tokenizer: "open-mixtral-8x7b",
    accuracy: "exact-local",
    accuracyDetail: EXACT,
    compatibility: "mistral-tokenizer-ts vocabulary for open-mixtral-8x7b.",
    supportsApiCount: false,
    libraryModel: "open-mixtral-8x7b",
    pricing: unpriced("Open-weight host pricing is not a Mistral API list price. Enter the rate you pay."),
  },
];

const BY_ID = new Map(MISTRAL_MODELS.map((entry) => [entry.id, entry]));

export function mistralModel(id: string): MistralModelSpec | undefined {
  return BY_ID.get(id);
}
