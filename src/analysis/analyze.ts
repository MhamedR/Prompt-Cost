import type { PriceOverride, TokenizerProvider } from "../types";
import type { ModelSpec } from "../types";
import { DISTRIBUTION_NOTE, tokenDistribution, type DistributionShare } from "./distribution";
import { textStats, type TextStats } from "./stats";
import { calculateCost, type CostEstimate } from "../pricing/calculator";
import { assertWithinLimit } from "../tokenization/result";
import type { TokenCountResult } from "../types";

export interface Analysis {
  textStats: TextStats;
  tokens: TokenCountResult;
  distribution: DistributionShare[];
  distributionNote: string;
  cost: CostEstimate;
}

export async function analyzeText(args: {
  text: string;
  model: ModelSpec;
  provider: TokenizerProvider;
  expectedOutputTokens: number;
  maxCharacters: number;
  priceOverride?: PriceOverride;
}): Promise<Analysis> {
  assertWithinLimit(args.text, args.maxCharacters);
  const tokens = await args.provider.countTokens(args.text, args.model.id);
  const distribution = await tokenDistribution(args.text, tokens.count, async (slice) => {
    const counted = await args.provider.countTokens(slice, args.model.id);
    return counted.count;
  });
  return {
    textStats: textStats(args.text, tokens.count),
    tokens,
    distribution,
    distributionNote: DISTRIBUTION_NOTE,
    cost: calculateCost({
      inputTokens: tokens.count,
      outputTokens: args.expectedOutputTokens,
      pricing: args.model.pricing,
      ...(args.priceOverride ? { override: args.priceOverride } : {}),
    }),
  };
}
