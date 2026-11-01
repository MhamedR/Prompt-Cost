import { describe, expect, it } from "vitest";
import { MODELS, getModel } from "./catalog";
import { PROVIDER_IDS } from "../types";

describe("model catalog", () => {
  it("has a unique id for every model", () => {
    const ids = MODELS.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every provider and the default model", () => {
    for (const providerId of PROVIDER_IDS) {
      expect(MODELS.some((model) => model.providerId === providerId)).toBe(true);
    }
    expect(getModel("gpt-5.4")?.providerId).toBe("openai");
  });

  it("records accuracy, a tokenizer, and a price tier for every model", () => {
    for (const model of MODELS) {
      expect(model.tokenizer.length).toBeGreaterThan(0);
      expect(model.accuracyDetail.length).toBeGreaterThan(0);
      expect(model.compatibility.length).toBeGreaterThan(0);
      expect(model.pricing.tiers.length).toBeGreaterThan(0);
      expect(model.pricing.currency).toBe("USD");
      if (model.supportsApiCount) {
        expect(model.apiModelId).toBeTruthy();
      }
    }
  });
});
