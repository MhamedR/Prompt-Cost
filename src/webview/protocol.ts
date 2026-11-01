import type { AttachmentPayload } from "../media/estimate";
import type { ProviderId } from "../types";
import type { PromptComparison } from "../analysis/compare";
import type { DistributionShare } from "../analysis/distribution";
import type { PricingKind, TokenAccuracy } from "../types";

export type SourceMode = "auto" | "document" | "selection";

export interface ModelView {
  id: string;
  label: string;
  providerId: ProviderId;
  tokenizer: string;
  accuracy: TokenAccuracy;
  accuracyLabel: string;
  accuracyDetail: string;
  compatibility: string;
  contextWindow?: number;
  pricingKind: PricingKind;
  pricingNotes: string;
  pricingSource: string;
  inputPerMillion: number;
  outputPerMillion: number;
}

export interface CostView {
  inputPerMillion: number;
  outputPerMillion: number;
  inputCost: string;
  outputCost: string;
  totalCost: string;
  inputAmount: number;
  outputAmount: number;
  totalAmount: number;
  inputTokens: number;
  outputTokens: number;
  tierNote: string;
  pricingKind: PricingKind;
  pricingNotes: string;
  usingOverride: boolean;
}

export interface AnalysisView {
  tokens: number;
  accuracy: TokenAccuracy;
  accuracyLabel: string;
  tokenizer: string;
  summary: string;
  warnings: string[];
  characters: number;
  words: number;
  lines: number;
  charsPerToken: string;
  distribution: DistributionShare[];
  distributionNote: string;
  attachmentTokens: number;
  cost: CostView;
}

export interface ApiCountView {
  count: number;
  summary: string;
}

export interface DashboardSnapshot {
  providerId: ProviderId;
  modelId: string;
  providers: Array<{ id: ProviderId; label: string }>;
  models: ModelView[];
  sourceMode: SourceMode;
  resolvedSource: "document" | "selection" | "prompt";
  sourceLabel: string;
  analysis: AnalysisView | null;
  error: string | null;
  counting: boolean;
  expectedOutputTokens: number;
  inputPerMillion: number;
  outputPerMillion: number;
  usingOverride: boolean;
  pricingKind: PricingKind;
  pricingNotes: string;
  tierNote: string;
  apiSupported: boolean;
  apiEnabled: boolean;
  apiKeyStored: boolean;
  apiCounting: boolean;
  apiCount: ApiCountView | null;
  apiError: string | null;
  focusToken: number;
  maxCharacters: number;
  disclaimer: string;
}

export type WebviewToHost =
  | { type: "ready" }
  | { type: "setModel"; providerId: string; modelId: string }
  | { type: "setExpectedOutputTokens"; tokens: number }
  | { type: "setPriceOverride"; inputPerMillion: number; outputPerMillion: number }
  | { type: "clearPriceOverride" }
  | { type: "setPrompt"; text: string }
  | { type: "setAttachments"; attachments: AttachmentPayload[] }
  | { type: "useEditor"; source: "document" | "selection" }
  | { type: "compare"; left: string; right: string; leftAttachments: AttachmentPayload[]; rightAttachments: AttachmentPayload[] }
  | { type: "countWithApi" };

export type HostToWebview =
  | { type: "snapshot"; snapshot: DashboardSnapshot }
  | { type: "comparison"; result: PromptComparison | null; error: string | null }
  | { type: "promptText"; text: string; error: string | null };
