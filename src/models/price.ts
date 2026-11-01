import type { ModelPricing, PriceTier } from "../types";

export function officialPrice(args: {
  asOf: string;
  source: string;
  sourceUrl: string;
  notes: string;
  tiers: PriceTier[];
}): ModelPricing {
  return {
    kind: "official",
    currency: "USD",
    asOf: args.asOf,
    source: args.source,
    sourceUrl: args.sourceUrl,
    notes: args.notes,
    tiers: args.tiers,
  };
}

export function unpriced(notes: string, sourceUrl = ""): ModelPricing {
  return {
    kind: "unpriced",
    currency: "USD",
    asOf: "2026-11-01",
    source: "No official per-token API price",
    sourceUrl,
    notes,
    tiers: [{ inputPerMillion: 0, outputPerMillion: 0 }],
  };
}
