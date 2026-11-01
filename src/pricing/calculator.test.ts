import { describe, expect, it } from "vitest";
import { getModel } from "../models/catalog";
import { calculateCost, selectTier } from "./calculator";

describe("calculateCost", () => {
  it("prices one million input tokens and a short completion", () => {
    const model = getModel("gpt-4.1");
    expect(model).toBeDefined();
    const cost = calculateCost({
      inputTokens: 1_000_000,
      outputTokens: 500,
      pricing: model!.pricing,
    });
    expect(cost.inputCost).toBe(2);
    expect(cost.outputCost).toBe(0.004);
    expect(cost.totalCost).toBe(2.004);
  });

  it("switches the GPT-5.4 tier above 272,000 tokens", () => {
    const model = getModel("gpt-5.4");
    expect(model).toBeDefined();
    const below = selectTier(model!.pricing.tiers, 272_000);
    const above = selectTier(model!.pricing.tiers, 272_001);
    expect(below.inputPerMillion).toBe(2.5);
    expect(above.inputPerMillion).toBe(5);
    expect(above.outputPerMillion).toBe(22.5);
  });

  it("lets an override replace the catalog tier", () => {
    const model = getModel("gpt-5.4");
    expect(model).toBeDefined();
    const cost = calculateCost({
      inputTokens: 272_001,
      outputTokens: 0,
      pricing: model!.pricing,
      override: { inputPerMillion: 1, outputPerMillion: 2 },
    });
    expect(cost.inputPerMillion).toBe(1);
    expect(cost.usingOverride).toBe(true);
    expect(cost.inputCost).toBeCloseTo(0.272001);
  });

  it("uses the higher Haiku 5.5 rate above 100,000 tokens", () => {
    const model = getModel("claude-haiku-5-5");
    expect(model).toBeDefined();
    expect(selectTier(model!.pricing.tiers, 100_000).inputPerMillion).toBe(0.1);
    expect(selectTier(model!.pricing.tiers, 100_001).outputPerMillion).toBe(2.5);
  });
});
