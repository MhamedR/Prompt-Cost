import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as path from "node:path";
import { readFileSync } from "node:fs";
import * as z from "zod/v4";
import { loadProvider } from "../tokenization/registry";
import { TextTooLongError, UnknownModelError } from "../tokenization/result";
import {
  MCP_DEFAULT_MAX_CHARACTERS,
  MCP_MAX_OUTPUT_TOKENS,
  MCP_MAX_TOOLS,
  McpInputError,
  createMcpService,
  type McpService,
} from "./service";

const INSTRUCTIONS =
  "Prompt Cost counts tokens and estimates API cost on this machine. Read the accuracy field before quoting a number: exact-local uses that provider's vocabulary, and approximate is an estimate or a related model's vocabulary. A count is not the full prompt an assistant sends unless the caller included system instructions, chat framing, images, and tool definitions in the text.";

const LOCAL_TOOL = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const providerSchema = z
  .enum(["openai", "anthropic", "gemini", "llama", "mistral", "deepseek"])
  .optional()
  .describe("Provider id. Used when model is omitted, and checked against model when both are set.");

const modelSchema = z
  .string()
  .min(1)
  .max(128)
  .optional()
  .describe("Catalog model id, such as gpt-5.4 or claude-sonnet-4-5. Defaults to gpt-5.4.");

const accuracySchema = z.enum(["exact-local", "provider-api", "approximate"]);
const providerIdSchema = z.enum(["openai", "anthropic", "gemini", "llama", "mistral", "deepseek"]);

const countOutput = {
  model: z.string(),
  provider: providerIdSchema,
  providerLabel: z.string(),
  tokens: z.number(),
  accuracy: accuracySchema,
  tokenizer: z.string(),
  summary: z.string(),
  warnings: z.array(z.string()),
  characters: z.number(),
  note: z.string(),
};

export function createPromptCostMcpServer(service: McpService): McpServer {
  const server = new McpServer(
    { name: "prompt-cost", version: service.version },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "count_tokens",
    {
      title: "Count tokens",
      description:
        "Count tokens for text with one catalog model. The count runs locally. It does not call a provider API and it does not store the text.",
      annotations: LOCAL_TOOL,
      inputSchema: {
        text: z.string().describe("Text to count."),
        provider: providerSchema,
        model: modelSchema,
      },
      outputSchema: countOutput,
    },
    async (input) => respond(() => service.countTokens(input)),
  );

  server.registerTool(
    "estimate_cost",
    {
      title: "Estimate cost",
      description:
        "Count input tokens locally and estimate input, output, and total USD cost from the published list price. Output cost uses outputTokens, because the text does not determine the completion length. Cache, batch, and tool-call prices are not applied.",
      annotations: LOCAL_TOOL,
      inputSchema: {
        text: z.string().describe("Prompt text to price as input."),
        provider: providerSchema,
        model: modelSchema,
        outputTokens: z
          .number()
          .min(0)
          .max(MCP_MAX_OUTPUT_TOKENS)
          .optional()
          .describe("Completion length to price. Defaults to 1024."),
      },
      outputSchema: {
        ...countOutput,
        outputTokens: z.number(),
        inputPerMillion: z.number(),
        outputPerMillion: z.number(),
        inputCost: z.number(),
        outputCost: z.number(),
        totalCost: z.number(),
        currency: z.literal("USD"),
        pricingKind: z.enum(["official", "unpriced"]),
        tierNote: z.string(),
        pricingNotes: z.string(),
      },
    },
    async (input) => respond(() => service.estimateCost(input)),
  );

  server.registerTool(
    "compare_prompts",
    {
      title: "Compare prompts",
      description:
        "Count two texts with the same model and report the token difference. A positive savingsPercent means the right-hand text is smaller.",
      annotations: LOCAL_TOOL,
      inputSchema: {
        left: z.string().describe("First prompt, treated as prompt A."),
        right: z.string().describe("Second prompt, treated as prompt B."),
        provider: providerSchema,
        model: modelSchema,
      },
      outputSchema: {
        model: z.string(),
        provider: providerIdSchema,
        providerLabel: z.string(),
        accuracy: accuracySchema,
        tokenizer: z.string(),
        leftTokens: z.number(),
        rightTokens: z.number(),
        delta: z.number(),
        savingsTokens: z.number(),
        savingsPercent: z.number().nullable(),
        summary: z.string(),
        warnings: z.array(z.string()),
        note: z.string(),
      },
    },
    async (input) => respond(() => service.comparePrompts(input)),
  );

  server.registerTool(
    "list_models",
    {
      title: "List models",
      description:
        "List catalog models with tokenizer, accuracy, context window, and the first published price tier. Prices are USD per 1,000,000 tokens. Unpriced models need a host rate before a cost estimate is meaningful.",
      annotations: LOCAL_TOOL,
      inputSchema: {
        provider: providerSchema,
      },
      outputSchema: {
        models: z.array(z.object({
          id: z.string(),
          label: z.string(),
          provider: providerIdSchema,
          providerLabel: z.string(),
          tokenizer: z.string(),
          accuracy: accuracySchema,
          accuracyDetail: z.string(),
          compatibility: z.string(),
          contextWindow: z.number().nullable(),
          inputPerMillion: z.number(),
          outputPerMillion: z.number(),
          pricingKind: z.enum(["official", "unpriced"]),
          pricingNotes: z.string(),
          warnings: z.array(z.string()),
        })),
      },
    },
    async (input) => respond(() => Promise.resolve(service.listModels(input))),
  );

  server.registerTool(
    "estimate_tool_definitions",
    {
      title: "Estimate tool-definition tokens",
      description:
        "Estimate how many tokens a list of MCP or function tool definitions adds. The count is for one JSON document of names, descriptions, and input schemas. It does not connect to any MCP server, and it does not include the provider's tool-calling wrapper.",
      annotations: LOCAL_TOOL,
      inputSchema: {
        tools: z
          .array(z.object({
            name: z.string().describe("Tool name."),
            description: z.string().optional().describe("Tool description shown to the model."),
            inputSchema: z.record(z.string(), z.unknown()).optional().describe("JSON Schema object for the tool input."),
          }))
          .min(1)
          .max(MCP_MAX_TOOLS),
        provider: providerSchema,
        model: modelSchema,
      },
      outputSchema: {
        model: z.string(),
        provider: providerIdSchema,
        providerLabel: z.string(),
        tokens: z.number(),
        accuracy: accuracySchema,
        tokenizer: z.string(),
        toolCount: z.number(),
        serializedCharacters: z.number(),
        summary: z.string(),
        warnings: z.array(z.string()),
        note: z.string(),
      },
    },
    async (input) => respond(() => service.estimateToolDefinitions(input)),
  );

  return server;
}

async function respond(run: () => Promise<unknown>): Promise<{
  content: [{ type: "text"; text: string }];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}> {
  try {
    const structuredContent = JSON.parse(JSON.stringify(await run())) as Record<string, unknown>;
    return {
      content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent,
    };
  } catch (error) {
    const message = safeErrorMessage(error);
    return {
      isError: true,
      content: [{ type: "text", text: message }],
    };
  }
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof McpInputError || error instanceof UnknownModelError || error instanceof TextTooLongError) {
    return error.message;
  }
  console.error(`PromptCost MCP tool failed: ${error instanceof Error ? error.name : "Error"}`);
  return "Token counting failed.";
}

function extensionRoot(): string {
  const configured = process.env.PROMPT_COST_EXTENSION_ROOT;
  if (configured !== undefined && configured.length > 0) {
    return configured;
  }
  return path.resolve(__dirname, "..");
}

function readMaxCharacters(): number {
  const raw = process.env.PROMPT_COST_MAX_CHARACTERS;
  if (raw === undefined || raw.trim().length === 0) {
    return MCP_DEFAULT_MAX_CHARACTERS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1000) {
    return MCP_DEFAULT_MAX_CHARACTERS;
  }
  return Math.floor(parsed);
}

function readVersion(root: string): string {
  try {
    const parsed = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function main(): Promise<void> {
  const root = extensionRoot();
  const service = createMcpService({
    version: readVersion(root),
    maxCharacters: readMaxCharacters(),
    loadProvider: (providerId) => loadProvider(root, providerId),
  });
  const server = createPromptCostMcpServer(service);
  await server.connect(new StdioServerTransport());
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "PromptCost MCP server failed to start.");
    process.exitCode = 1;
  });
}
