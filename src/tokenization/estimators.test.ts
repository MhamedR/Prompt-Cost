import { describe, expect, it } from "vitest";
import { estimateDeepSeekV4Tokens } from "./providers/deepseekEstimator";
import { estimateGeminiTokens } from "./providers/geminiEstimator";
import { estimateLlama4Tokens } from "./providers/llama4Estimator";

describe("local estimates", () => {
  it("uses a different rule for each provider family", () => {
    const text = "hello world";
    const gemini = estimateGeminiTokens(text);
    const deepseek = estimateDeepSeekV4Tokens(text);
    const llama4 = estimateLlama4Tokens(text);
    expect(gemini).toBe(5);
    expect(deepseek).toBe(4);
    expect(llama4).toBe(3);
    expect(new Set([gemini, deepseek, llama4]).size).toBe(3);
  });

  it("counts CJK and empty text without sharing one formula", () => {
    expect(estimateGeminiTokens("")).toBe(0);
    expect(estimateDeepSeekV4Tokens("")).toBe(0);
    expect(estimateLlama4Tokens("")).toBe(0);
    expect(estimateGeminiTokens("你好")).toBe(2);
    expect(estimateDeepSeekV4Tokens("你好")).toBe(2);
    expect(estimateLlama4Tokens("你好")).toBe(1);
  });
});
