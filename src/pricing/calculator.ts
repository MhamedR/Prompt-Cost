import type { ModelPricing, PriceOverride, PriceTier, PricingKind } from "../types";

export interface CostEstimate {
  currency: "USD";
  inputTokens: number;
  outputTokens: number;
  inputPerMillion: number;
  outputPerMillion: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  tierNote: string;
  pricingKind: PricingKind;
  pricingNotes: string;
  usingOverride: boolean;
}

export function selectTier(tiers: readonly PriceTier[], inputTokens: number): PriceTier {
  if (tiers.length === 0) {
    return { inputPerMillion: 0, outputPerMillion: 0 };
  }
  for (const tier of tiers) {
    if (tier.maxInputTokens === undefined || inputTokens <= tier.maxInputTokens) {
      return tier;
    }
  }
  return tiers[tiers.length - 1] ?? { inputPerMillion: 0, outputPerMillion: 0 };
}

export function calculateCost(args: {
  inputTokens: number;
  outputTokens: number;
  pricing: ModelPricing;
  override?: PriceOverride;
}): CostEstimate {
  const tier = selectTier(args.pricing.tiers, args.inputTokens);
  const inputPerMillion = args.override?.inputPerMillion ?? tier.inputPerMillion;
  const outputPerMillion = args.override?.outputPerMillion ?? tier.outputPerMillion;
  const inputCost = (args.inputTokens / 1_000_000) * inputPerMillion;
  const outputCost = (args.outputTokens / 1_000_000) * outputPerMillion;
  const tierNote = args.override
    ? "Using the price you entered for this model. Catalog tiers are ignored."
    : describeTier(args.pricing.tiers, tier);

  return {
    currency: "USD",
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    inputPerMillion,
    outputPerMillion,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    tierNote,
    pricingKind: args.pricing.kind,
    pricingNotes: args.pricing.notes,
    usingOverride: args.override !== undefined,
  };
}

function describeTier(tiers: readonly PriceTier[], selected: PriceTier): string {
  if (
    tiers.length <= 1 ||
    (selected.maxInputTokens === undefined && tiers[0]?.maxInputTokens === undefined)
  ) {
    return "Single published rate.";
  }
  if (selected.maxInputTokens !== undefined) {
    return `Rate for inputs up to ${selected.maxInputTokens.toLocaleString("en-US")} tokens.`;
  }
  const previous = tiers[tiers.length - 2];
  if (previous?.maxInputTokens !== undefined) {
    return `Rate for inputs above ${previous.maxInputTokens.toLocaleString("en-US")} tokens.`;
  }
  return "Upper published rate.";
}
