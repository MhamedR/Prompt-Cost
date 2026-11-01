import { describe, expect, it } from "vitest";
import { classifyLine, scaleShares, splitByBucket } from "./distribution";

describe("distribution", () => {
  it("classifies blank, prose, and code lines", () => {
    expect(classifyLine("   ")).toBe("blank");
    expect(classifyLine("Explain this function.")).toBe("prose");
    expect(classifyLine("const value = 1;")).toBe("code");
  });

  it("scales group counts so they sum to the full-text total", () => {
    const shares = scaleShares({ code: 1, prose: 1, blank: 0 }, 10);
    expect(shares.reduce((sum, share) => sum + share.tokens, 0)).toBe(10);
    expect(shares.find((share) => share.bucket === "blank")?.tokens).toBe(0);
  });

  it("keeps an empty document in empty groups", () => {
    expect(splitByBucket("")).toEqual({ code: "", prose: "", blank: "" });
  });
});
