import { describe, expect, it } from "vitest";
import { publicApiError } from "./providerApi";

describe("provider API errors", () => {
  it("hides a response that echoes the prompt", () => {
    const prompt = "export const secretProjectName = 'atlas';";
    const body = JSON.stringify({
      error: { message: `Invalid model for ${prompt}` },
    });
    expect(publicApiError(400, body, prompt)).toBe("The provider rejected the token count (HTTP 400).");
  });

  it("keeps a short provider message that does not contain the prompt", () => {
    const body = JSON.stringify({ error: { message: "model not found" } });
    expect(publicApiError(404, body, "hello world")).toContain("model not found");
  });

  it("reads an Anthropic count without sending the key back in the result", async () => {
    const { countWithProviderApi } = await import("./providerApi");
    const seen = new Headers();
    const fetchImpl: typeof fetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      headers.forEach((value, key) => seen.set(key, value));
      return new Response(JSON.stringify({ input_tokens: 11 }), { status: 200 });
    };
    const result = await countWithProviderApi({
      providerId: "anthropic",
      modelId: "claude-sonnet-4-5",
      text: "hello",
      apiKey: "sk-test",
      fetchImpl,
    });
    expect(result.count).toBe(11);
    expect(result.summary).toContain("count_tokens");
    expect(seen.get("x-api-key")).toBe("sk-test");
    expect(JSON.stringify(result)).not.toContain("sk-test");
  });
});
