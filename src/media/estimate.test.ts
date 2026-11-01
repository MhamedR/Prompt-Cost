import { describe, expect, it } from "vitest";
import { claudeImageTokens, estimateAttachments, openaiImageTokens, textForCounting } from "./estimate";

describe("image token rules", () => {
  it("matches OpenAI's published patch examples", () => {
    expect(openaiImageTokens("gpt-5.6-sol", 1024, 1024)).toBe(1229);
    expect(openaiImageTokens("gpt-5.4", 2048, 2048)).toBe(3000);
    expect(openaiImageTokens("gpt-5.6-sol", 4096, 512)).toBe(2458);
  });

  it("matches the GPT-4o high-detail tile count for a square image", () => {
    expect(openaiImageTokens("gpt-4o", 1024, 1024)).toBe(765);
  });

  it("matches Claude's published image examples", () => {
    expect(claudeImageTokens("claude-sonnet-4-5", 200, 200)).toBe(64);
    expect(claudeImageTokens("claude-sonnet-4-5", 1000, 1000)).toBe(1296);
    expect(claudeImageTokens("claude-sonnet-4-5", 1920, 1080)).toBe(1560);
    expect(claudeImageTokens("claude-opus-4-7", 1920, 1080)).toBe(2691);
  });
});

describe("attachment estimates", () => {
  it("counts extracted document text with the prompt and leaves the file out of the media total", () => {
    expect(textForCounting("Hello", [{
      id: "1",
      name: "notes.txt",
      kind: "document",
      bytes: 11,
      text: "notes",
    }])).toBe("Hello\n\nnotes");
    const estimate = estimateAttachments({
      providerId: "openai",
      modelId: "gpt-5.4",
      attachments: [{ id: "1", name: "notes.txt", kind: "document", bytes: 11, text: "notes" }],
    });
    expect(estimate.tokens).toBe(0);
    expect(estimate.warnings).toEqual([]);
  });

  it("uses Gemini's published audio rate", () => {
    const estimate = estimateAttachments({
      providerId: "gemini",
      modelId: "gemini-3.8-flash",
      attachments: [{ id: "1", name: "clip.mp3", kind: "audio", bytes: 16000, durationSeconds: 10 }],
    });
    expect(estimate.tokens).toBe(250);
  });
});
