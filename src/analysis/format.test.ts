import { describe, expect, it } from "vitest";
import { formatPercent, formatUsd } from "./format";

describe("formatUsd", () => {
  it("formats zero, tiny, and ordinary amounts", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.0000001)).toBe("<$0.000001");
    expect(formatUsd(0.001234)).toBe("$0.001234");
    expect(formatUsd(0.125)).toBe("$0.1250");
    expect(formatUsd(12.5)).toBe("$12.50");
    expect(formatUsd(-2)).toBe("-$2.00");
  });
});

describe("formatPercent", () => {
  it("rounds to one decimal", () => {
    expect(formatPercent(12.34)).toBe("12.3%");
    expect(formatPercent(null)).toBe("—");
  });
});
