import { officialPrice, unpriced } from "./price";
import type { ModelSpec } from "../types";

const SOURCE = "DeepSeek API pricing";
const SOURCE_URL = "https://api-docs.deepseek.com/quick_start/pricing";
const AS_OF = "2026-11-01";

const EXACT =
  "Exact count of the raw text with the published tokenizer in @cyberlangke/tokkit-deepseek. Special tokens are not added.";

const APPROXIMATE =
  "Approximate byte-oriented estimate. The DeepSeek V4 tokenizer is not in the bundled V3 and R1 package, and those vocabularies are not reused.";

const PEAK =
  "Peak cache-miss list price in USD per 1M tokens. Off-peak rates are half. Cache hits are cheaper and are not applied. Peak hours are 01:00–04:00 and 06:00–10:00 UTC on weekdays, excluding Chinese public holidays.";

interface DeepSeekExtra {
  family?: string;
}

export type DeepSeekModelSpec = ModelSpec & DeepSeekExtra;

export const DEEPSEEK_MODELS: DeepSeekModelSpec[] = [
  {
    id: "deepseek-flash",
    label: "DeepSeek Flash",
    providerId: "deepseek",
    contextWindow: 1_000_000,
    tokenizer: "deepseek-v4-estimate",
    accuracy: "approximate",
    accuracyDetail: APPROXIMATE,
    compatibility:
      "Current API model deepseek-flash (DeepSeek-V4.1-Flash). The bundled package covers V3 and R1 only, so this model has its own estimate.",
    supportsApiCount: false,
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: PEAK,
      tiers: [{ inputPerMillion: 0.3, outputPerMillion: 1.2 }],
    }),
  },
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    providerId: "deepseek",
    contextWindow: 1_000_000,
    tokenizer: "deepseek-v4-estimate",
    accuracy: "approximate",
    accuracyDetail: APPROXIMATE,
    compatibility: "Current API model deepseek-v4-pro. V4 is not in the bundled V3 and R1 tokenizer package.",
    supportsApiCount: false,
    pricing: officialPrice({
      asOf: AS_OF,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      notes: PEAK,
      tiers: [{ inputPerMillion: 1.32, outputPerMillion: 3.96 }],
    }),
  },
  {
    id: "deepseek-v3",
    label: "DeepSeek V3",
    providerId: "deepseek",
    tokenizer: "deepseek-v3",
    accuracy: "exact-local",
    accuracyDetail: EXACT,
    compatibility: "Family deepseek-v3 in @cyberlangke/tokkit-deepseek.",
    supportsApiCount: false,
    family: "deepseek-v3",
    pricing: unpriced("Not on the current DeepSeek API price card. Enter a host rate if you serve these weights."),
  },
  {
    id: "deepseek-v3.1",
    label: "DeepSeek V3.1",
    providerId: "deepseek",
    tokenizer: "deepseek-v3.1",
    accuracy: "exact-local",
    accuracyDetail: EXACT,
    compatibility: "Family deepseek-v3.1 in @cyberlangke/tokkit-deepseek.",
    supportsApiCount: false,
    family: "deepseek-v3.1",
    pricing: unpriced("Not on the current DeepSeek API price card. Enter a host rate if you serve these weights."),
  },
  {
    id: "deepseek-v3.2",
    label: "DeepSeek V3.2",
    providerId: "deepseek",
    tokenizer: "deepseek-v3.2",
    accuracy: "exact-local",
    accuracyDetail: EXACT,
    compatibility: "Family deepseek-v3.2 in @cyberlangke/tokkit-deepseek.",
    supportsApiCount: false,
    family: "deepseek-v3.2",
    pricing: unpriced("Not on the current DeepSeek API price card. Enter a host rate if you serve these weights."),
  },
  {
    id: "deepseek-r1",
    label: "DeepSeek R1",
    providerId: "deepseek",
    tokenizer: "deepseek-r1",
    accuracy: "exact-local",
    accuracyDetail: EXACT,
    compatibility: "Family deepseek-r1 in @cyberlangke/tokkit-deepseek.",
    supportsApiCount: false,
    family: "deepseek-r1",
    pricing: unpriced("Not on the current DeepSeek API price card. Enter a host rate if you serve these weights."),
  },
];

const BY_ID = new Map(DEEPSEEK_MODELS.map((entry) => [entry.id, entry]));

export function deepSeekModel(id: string): DeepSeekModelSpec | undefined {
  return BY_ID.get(id);
}
