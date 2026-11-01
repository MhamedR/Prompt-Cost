import { compareTokenCounts } from "../analysis/compare";
import { MODELS, defaultModelFor, getModel, modelsForProvider, PROVIDER_LABELS } from "../models/catalog";
import { calculateCost } from "../pricing/calculator";
import { TextTooLongError, UnknownModelError, assertWithinLimit } from "../tokenization/result";
import type { ModelSpec, ProviderId, TokenAccuracy, TokenCountResult, TokenizerProvider } from "../types";
import { isProviderId, PROVIDER_IDS } from "../types";

export const MCP_DEFAULT_MODEL = "gpt-5.4";
export const MCP_DEFAULT_OUTPUT_TOKENS = 1024;
export const MCP_DEFAULT_MAX_CHARACTERS = 1_000_000;
export const MCP_MAX_OUTPUT_TOKENS = 10_000_000;
export const MCP_MAX_TOOLS = 128;

export const MCP_NOTE =
  "Counted locally. The text was not stored or sent to a model provider. This is only the text passed to the tool, not the full prompt an assistant sends. System instructions, chat framing, images, and other tool definitions are outside this count unless they were included in that text.";

export const TOOL_DEFINITION_NOTE =
  "This counts one JSON document of the tool names, descriptions, and input schemas. Provider-specific tool-calling frames are not included, so a real request can use more tokens than this number.";

const TOOL_NAME = /^[A-Za-z0-9_.:-]{1,128}$/;

export class McpInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpInputError";
  }
}

export interface McpServiceOptions {
  version: string;
  maxCharacters: number;
  loadProvider: (providerId: ProviderId) => TokenizerProvider;
}

export interface CountPayload {
  model: string;
  provider: ProviderId;
  providerLabel: string;
  tokens: number;
  accuracy: TokenAccuracy;
  tokenizer: string;
  summary: string;
  warnings: string[];
  characters: number;
  note: string;
}

export interface CostPayload extends CountPayload {
  outputTokens: number;
  inputPerMillion: number;
  outputPerMillion: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: "USD";
  pricingKind: "official" | "unpriced";
  tierNote: string;
  pricingNotes: string;
}

export interface ComparePayload {
  model: string;
  provider: ProviderId;
  providerLabel: string;
  accuracy: TokenAccuracy;
  tokenizer: string;
  leftTokens: number;
  rightTokens: number;
  delta: number;
  savingsTokens: number;
  savingsPercent: number | null;
  summary: string;
  warnings: string[];
  note: string;
}

export interface ModelPayload {
  id: string;
  label: string;
  provider: ProviderId;
  providerLabel: string;
  tokenizer: string;
  accuracy: TokenAccuracy;
  accuracyDetail: string;
  compatibility: string;
  contextWindow: number | null;
  inputPerMillion: number;
  outputPerMillion: number;
  pricingKind: "official" | "unpriced";
  pricingNotes: string;
  warnings: string[];
}

export interface ToolDefinitionInput {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface ToolDefinitionPayload {
  model: string;
  provider: ProviderId;
  providerLabel: string;
  tokens: number;
  accuracy: TokenAccuracy;
  tokenizer: string;
  toolCount: number;
  serializedCharacters: number;
  summary: string;
  warnings: string[];
  note: string;
}

export interface McpService {
  readonly version: string;
  countTokens(input: { text: string; provider?: string; model?: string }): Promise<CountPayload>;
  estimateCost(input: {
    text: string;
    provider?: string;
    model?: string;
    outputTokens?: number;
  }): Promise<CostPayload>;
  comparePrompts(input: {
    left: string;
    right: string;
    provider?: string;
    model?: string;
  }): Promise<ComparePayload>;
  listModels(input: { provider?: string }): { models: ModelPayload[] };
  estimateToolDefinitions(input: {
    tools: ToolDefinitionInput[];
    provider?: string;
    model?: string;
  }): Promise<ToolDefinitionPayload>;
}

export function createMcpService(options: McpServiceOptions): McpService {
  async function countText(text: string, model: ModelSpec): Promise<TokenCountResult> {
    assertWithinLimit(text, options.maxCharacters);
    try {
      return await options.loadProvider(model.providerId).countTokens(text, model.id);
    } catch (error) {
      if (error instanceof UnknownModelError || error instanceof McpInputError || error instanceof TextTooLongError) {
        throw error;
      }
      throw new McpInputError("Token counting failed.");
    }
  }

  return {
    version: options.version,

    async countTokens(input) {
      const model = resolveModel(input.provider, input.model);
      const counted = await countText(input.text, model);
      return countPayload(model, input.text.length, counted);
    },

    async estimateCost(input) {
      const model = resolveModel(input.provider, input.model);
      const outputTokens = resolveOutputTokens(input.outputTokens);
      const counted = await countText(input.text, model);
      const cost = calculateCost({
        inputTokens: counted.count,
        outputTokens,
        pricing: model.pricing,
      });
      return {
        ...countPayload(model, input.text.length, counted),
        outputTokens,
        inputPerMillion: cost.inputPerMillion,
        outputPerMillion: cost.outputPerMillion,
        inputCost: cost.inputCost,
        outputCost: cost.outputCost,
        totalCost: cost.totalCost,
        currency: cost.currency,
        pricingKind: model.pricing.kind,
        tierNote: cost.tierNote,
        pricingNotes: model.pricing.notes,
      };
    },

    async comparePrompts(input) {
      const model = resolveModel(input.provider, input.model);
      const left = await countText(input.left, model);
      const right = await countText(input.right, model);
      const comparison = compareTokenCounts(left.count, right.count);
      return {
        model: model.id,
        provider: model.providerId,
        providerLabel: PROVIDER_LABELS[model.providerId],
        accuracy: left.accuracy,
        tokenizer: left.tokenizer,
        leftTokens: comparison.leftTokens,
        rightTokens: comparison.rightTokens,
        delta: comparison.delta,
        savingsTokens: comparison.savingsTokens,
        savingsPercent: comparison.savingsPercent,
        summary: comparison.summary,
        warnings: [...new Set([...left.warnings, ...right.warnings])],
        note: MCP_NOTE,
      };
    },

    listModels(input) {
      const provider = input.provider === undefined ? undefined : requireProvider(input.provider);
      const models = provider === undefined ? MODELS : modelsForProvider(provider);
      return { models: models.map(modelPayload) };
    },

    async estimateToolDefinitions(input) {
      const model = resolveModel(input.provider, input.model);
      const serialized = serializeToolDefinitions(input.tools);
      const counted = await countText(serialized, model);
      return {
        model: model.id,
        provider: model.providerId,
        providerLabel: PROVIDER_LABELS[model.providerId],
        tokens: counted.count,
        accuracy: counted.accuracy,
        tokenizer: counted.tokenizer,
        toolCount: input.tools.length,
        serializedCharacters: serialized.length,
        summary: counted.summary,
        warnings: [...counted.warnings, TOOL_DEFINITION_NOTE],
        note: `${MCP_NOTE} ${TOOL_DEFINITION_NOTE}`,
      };
    },
  };
}

export function resolveModel(provider: string | undefined, modelId: string | undefined): ModelSpec {
  const providerId = provider === undefined ? undefined : requireProvider(provider);
  if (modelId !== undefined) {
    const model = getModel(modelId);
    if (!model) {
      throw new McpInputError(`Unknown model "${modelId}". Call list_models to see the catalog.`);
    }
    if (providerId !== undefined && model.providerId !== providerId) {
      throw new McpInputError(`Model "${model.id}" belongs to ${model.providerId}, not ${providerId}.`);
    }
    return model;
  }
  if (providerId !== undefined) {
    return defaultModelFor(providerId);
  }
  const fallback = getModel(MCP_DEFAULT_MODEL);
  if (!fallback) {
    throw new McpInputError(`The default model ${MCP_DEFAULT_MODEL} is not in the catalog.`);
  }
  return fallback;
}

export function resolveOutputTokens(value: number | undefined): number {
  if (value === undefined) {
    return MCP_DEFAULT_OUTPUT_TOKENS;
  }
  if (!Number.isFinite(value) || value < 0 || value > MCP_MAX_OUTPUT_TOKENS) {
    throw new McpInputError(`outputTokens must be a finite number from 0 through ${MCP_MAX_OUTPUT_TOKENS.toLocaleString("en-US")}.`);
  }
  return Math.floor(value);
}

export function serializeToolDefinitions(tools: readonly ToolDefinitionInput[]): string {
  if (tools.length === 0) {
    throw new McpInputError("Provide at least one tool definition.");
  }
  if (tools.length > MCP_MAX_TOOLS) {
    throw new McpInputError(`A request can include at most ${MCP_MAX_TOOLS} tool definitions.`);
  }
  const document = {
    tools: tools.map((tool) => {
      if (!TOOL_NAME.test(tool.name)) {
        throw new McpInputError("Each tool name must be 1 to 128 characters of letters, numbers, underscore, dot, colon, or hyphen.");
      }
      const description = tool.description ?? "";
      if (description.length > 20_000) {
        throw new McpInputError(`The description for "${tool.name}" is longer than 20,000 characters.`);
      }
      return {
        name: tool.name,
        description,
        input_schema: tool.inputSchema ?? { type: "object", properties: {} },
      };
    }),
  };
  return JSON.stringify(document);
}

export function requireProvider(value: string): ProviderId {
  if (!isProviderId(value)) {
    throw new McpInputError(`Unknown provider "${value}". Expected one of: ${PROVIDER_IDS.join(", ")}.`);
  }
  return value;
}

function countPayload(model: ModelSpec, characters: number, counted: TokenCountResult): CountPayload {
  return {
    model: model.id,
    provider: model.providerId,
    providerLabel: PROVIDER_LABELS[model.providerId],
    tokens: counted.count,
    accuracy: counted.accuracy,
    tokenizer: counted.tokenizer,
    summary: counted.summary,
    warnings: counted.warnings,
    characters,
    note: MCP_NOTE,
  };
}

function modelPayload(model: ModelSpec): ModelPayload {
  const tier = model.pricing.tiers[0];
  return {
    id: model.id,
    label: model.label,
    provider: model.providerId,
    providerLabel: PROVIDER_LABELS[model.providerId],
    tokenizer: model.tokenizer,
    accuracy: model.accuracy,
    accuracyDetail: model.accuracyDetail,
    compatibility: model.compatibility,
    contextWindow: model.contextWindow ?? null,
    inputPerMillion: tier?.inputPerMillion ?? 0,
    outputPerMillion: tier?.outputPerMillion ?? 0,
    pricingKind: model.pricing.kind,
    pricingNotes: model.pricing.notes,
    warnings: model.warnings ?? [],
  };
}
