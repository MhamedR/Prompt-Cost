import { describe, expect, it } from "vitest";
import { compareTokenCounts } from "./compare";

describe("compareTokenCounts", () => {
  it("reports savings when the second prompt is smaller", () => {
    const result = compareTokenCounts(100, 80);
    expect(result.delta).toBe(-20);
    expect(result.savingsTokens).toBe(20);
    expect(result.savingsPercent).toBe(20);
    expect(result.summary).toContain("20% smaller");
  });

  it("reports growth when the second prompt is larger", () => {
    const result = compareTokenCounts(80, 100);
    expect(result.savingsTokens).toBe(-20);
    expect(result.summary).toContain("25% larger");
  });

  it("handles an empty baseline", () => {
    const result = compareTokenCounts(0, 10);
    expect(result.savingsPercent).toBeNull();
    expect(result.summary).toContain("larger");
  });
});
