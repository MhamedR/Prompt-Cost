import { describe, expect, it } from "vitest";
import { provider as anthropic } from "./providers/anthropic";
import { provider as deepseek } from "./providers/deepseek";
import { provider as gemini } from "./providers/gemini";
import { provider as llama } from "./providers/llama";
import { provider as mistral } from "./providers/mistral";
import { provider as openai } from "./providers/openai";
import { MODELS } from "../models/catalog";

const sample = "GPT-4o tokenizes differently than GPT-4.";
const cjk = "你好世界";

describe("provider tokenizers", () => {
  it("counts OpenAI text with the encoding that belongs to the model", async () => {
    const modern = await openai.countTokens(sample, "gpt-4o");
    const legacy = await openai.countTokens(sample, "gpt-4-turbo");
    expect(modern).toMatchObject({ count: 12, accuracy: "exact-local", tokenizer: "o200k_base" });
    expect(legacy).toMatchObject({ count: 14, accuracy: "exact-local", tokenizer: "cl100k_base" });
    expect(await openai.countTokens("hello world", "gpt-5.4")).toMatchObject({ count: 2 });
    expect((await openai.countTokens("<|endoftext|>", "gpt-4o")).count).toBeGreaterThan(0);
  });

  it("does not reuse the OpenAI tokenizer for Claude, Llama, Gemini, or DeepSeek", async () => {
    const openAi = await openai.countTokens(cjk, "gpt-4o");
    const claude = await anthropic.countTokens(cjk, "claude-sonnet-4-5");
    const llama3 = await llama.countTokens(cjk, "llama-3.3-70b");
    const llama4 = await llama.countTokens("hello world", "llama-4-scout");
    const geminiCount = await gemini.countTokens("hello world", "gemini-2.5-flash");
    const deepseekV4 = await deepseek.countTokens("hello world", "deepseek-flash");
    const deepseekV3 = await deepseek.countTokens("hello world", "deepseek-v3");
    expect(claude.accuracy).toBe("approximate");
    expect(claude.count).not.toBe(openAi.count);
    expect(llama3).toMatchObject({ accuracy: "exact-local", tokenizer: "llama3" });
    expect(llama3.count).not.toBe(openAi.count);
    expect(llama4).toMatchObject({ accuracy: "approximate", count: 3 });
    expect(geminiCount).toMatchObject({ accuracy: "approximate", count: 5 });
    expect(deepseekV4).toMatchObject({ accuracy: "approximate", count: 4 });
    expect(deepseekV3).toMatchObject({ accuracy: "exact-local", count: 2, tokenizer: "deepseek-v3" });
  });

  it("uses the Tekken vocabulary for Mistral Nemo and a different one for Mistral 7B", async () => {
    const nemo = await mistral.countTokens(cjk, "open-mistral-nemo");
    const small = await mistral.countTokens(cjk, "open-mistral-7b");
    expect(nemo).toMatchObject({ accuracy: "exact-local", count: 2 });
    expect(small).toMatchObject({ accuracy: "exact-local", count: 5 });
    const large4 = await mistral.countTokens("hello world", "mistral-large-4");
    expect(large4.accuracy).toBe("approximate");
    expect(large4.summary).toContain("mistral-large-2407");
  });

  it("counts every catalog model on a short string", async () => {
    const providers = { openai, anthropic, gemini, llama, mistral, deepseek };
    for (const model of MODELS) {
      const result = await providers[model.providerId].countTokens("Hello", model.id);
      expect(result.count).toBeGreaterThan(0);
      expect(result.tokenizer).toBe(model.tokenizer);
      expect(result.accuracy).toBe(model.accuracy);
    }
  }, 30_000);

  it("returns zero for empty text", async () => {
    expect((await openai.countTokens("", "gpt-4o")).count).toBe(0);
    expect((await gemini.countTokens("", "gemini-2.5-pro")).count).toBe(0);
    expect((await mistral.countTokens("", "open-mistral-nemo")).count).toBe(0);
  });
});
