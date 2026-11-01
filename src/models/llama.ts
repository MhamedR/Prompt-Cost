import { unpriced } from "./price";
import type { ModelSpec } from "../types";

const EXACT =
  "Exact count of the raw text with the Llama 3 tokenizer in llama3-tokenizer-js. BOS, EOS, and the chat template are not included. Llama 4 does not use this tokenizer.";

const APPROXIMATE =
  "Approximate local estimate. Meta's Llama 4 tokenizer is not bundled, and the Llama 3 tokenizer is not reused for it.";

const UNPRICED =
  "Meta publishes the weights, not a single per-token API price. Enter the input and output rates charged by the host you call.";

function exact(spec: Omit<ModelSpec, "providerId" | "accuracy" | "accuracyDetail" | "tokenizer" | "supportsApiCount" | "pricing">): ModelSpec {
  return {
    providerId: "llama",
    tokenizer: "llama3",
    accuracy: "exact-local",
    accuracyDetail: EXACT,
    supportsApiCount: false,
    pricing: unpriced(UNPRICED, "https://www.llama.com/"),
    ...spec,
  };
}

function approximate(spec: Omit<ModelSpec, "providerId" | "accuracy" | "accuracyDetail" | "tokenizer" | "supportsApiCount" | "pricing">): ModelSpec {
  return {
    providerId: "llama",
    tokenizer: "llama4-local-estimate",
    accuracy: "approximate",
    accuracyDetail: APPROXIMATE,
    supportsApiCount: false,
    pricing: unpriced(UNPRICED, "https://www.llama.com/"),
    ...spec,
  };
}

export const LLAMA_MODELS: ModelSpec[] = [
  exact({
    id: "llama-3.3-70b",
    label: "Llama 3.3 70B",
    compatibility: "Llama 3 tokenizer. Llama 3.3 uses the Llama 3 vocabulary.",
  }),
  exact({
    id: "llama-3.1-8b",
    label: "Llama 3.1 8B",
    compatibility: "Llama 3 tokenizer. Llama 3.1 uses the Llama 3 vocabulary.",
  }),
  exact({
    id: "llama-3.1-70b",
    label: "Llama 3.1 70B",
    compatibility: "Llama 3 tokenizer. Llama 3.1 uses the Llama 3 vocabulary.",
  }),
  exact({
    id: "llama-3.1-405b",
    label: "Llama 3.1 405B",
    compatibility: "Llama 3 tokenizer. Llama 3.1 uses the Llama 3 vocabulary.",
  }),
  approximate({
    id: "llama-4-scout",
    label: "Llama 4 Scout",
    compatibility: "Separate from the Llama 3 tokenizer. Treat the count as a rough size check.",
  }),
  approximate({
    id: "llama-4-maverick",
    label: "Llama 4 Maverick",
    compatibility: "Separate from the Llama 3 tokenizer. Treat the count as a rough size check.",
  }),
];

const BY_ID = new Map(LLAMA_MODELS.map((entry) => [entry.id, entry]));

export function llamaModel(id: string): ModelSpec | undefined {
  return BY_ID.get(id);
}
