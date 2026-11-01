import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import type { TokenizerProvider } from "../types";
import { provider as openai } from "../tokenization/providers/openai";
import { createPromptCostMcpServer } from "./server";
import { McpInputError, createMcpService, serializeToolDefinitions } from "./service";

const fake: TokenizerProvider = {
  id: "openai",
  displayName: "OpenAI",
  async countTokens(text) {
    return {
      count: text.length,
      accuracy: "approximate",
      tokenizer: "fake",
      summary: "One token per character in this test.",
      warnings: [],
    };
  },
};

function service() {
  return createMcpService({
    version: "test",
    maxCharacters: 100,
    loadProvider: () => fake,
  });
}

describe("MCP service", () => {
  it("prices the default model from the character count", async () => {
    const cost = await service().estimateCost({ text: "hello" });
    expect(cost.model).toBe("gpt-5.4");
    expect(cost.tokens).toBe(5);
    expect(cost.outputTokens).toBe(1024);
    expect(cost.inputCost).toBeCloseTo((5 / 1_000_000) * 2.5);
    expect(cost.outputCost).toBeCloseTo((1024 / 1_000_000) * 15);
    expect(cost.accuracy).toBe("approximate");
  });

  it("rejects a model from a different provider", async () => {
    await expect(service().countTokens({ text: "hello", provider: "anthropic", model: "gpt-5.4" })).rejects.toBeInstanceOf(McpInputError);
  });

  it("does not include the prompt in an unknown-model error", async () => {
    const secret = "SECRET_PROMPT_TEXT";
    await expect(service().countTokens({ text: secret, model: "not-a-model" })).rejects.toThrow(McpInputError);
    try {
      await service().countTokens({ text: secret, model: "not-a-model" });
    } catch (error) {
      expect(error).toBeInstanceOf(McpInputError);
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it("reports when the second prompt is smaller", async () => {
    const compared = await service().comparePrompts({ left: "abcd", right: "ab" });
    expect(compared.leftTokens).toBe(4);
    expect(compared.rightTokens).toBe(2);
    expect(compared.savingsPercent).toBe(50);
  });

  it("counts a stable JSON document for tool definitions", async () => {
    const tools = [{ name: "ping", description: "hi", inputSchema: { type: "object" } }];
    const serialized = serializeToolDefinitions(tools);
    const estimate = await service().estimateToolDefinitions({ tools, model: "gpt-4o" });
    expect(estimate.tokens).toBe(serialized.length);
    expect(estimate.toolCount).toBe(1);
    expect(estimate.warnings.at(-1)).toContain("tool-calling frames");
  });
});

describe("MCP server", () => {
  it("counts hello world with the OpenAI tokenizer", async () => {
    const server = createPromptCostMcpServer(createMcpService({
      version: "test",
      maxCharacters: 10_000,
      loadProvider: () => openai,
    }));
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "prompt-cost-test", version: "0.0.0" });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    try {
      const listed = await client.listTools();
      expect(listed.tools.map((tool) => tool.name).sort()).toEqual([
        "compare_prompts",
        "count_tokens",
        "estimate_cost",
        "estimate_tool_definitions",
        "list_models",
      ]);
      const result = await client.callTool({
        name: "count_tokens",
        arguments: { text: "hello world", model: "gpt-4o" },
      });
      expect(result.isError).not.toBe(true);
      const block = result.content[0];
      expect(block).toMatchObject({ type: "text" });
      if (!block || block.type !== "text") {
        throw new Error("Expected a text result.");
      }
      const parsed = JSON.parse(block.text) as { tokens: number; accuracy: string };
      expect(parsed.tokens).toBe(2);
      expect(parsed.accuracy).toBe("exact-local");
    } finally {
      await client.close();
      await server.close();
    }
  });
});
