import type * as vscode from "vscode";
import { STATE_KEY } from "../constants";
import { defaultModelFor, getModel } from "../models/catalog";
import type { AnalyzerSettings } from "../configuration/settings";
import type { PriceOverride, ProviderId } from "../types";
import { isProviderId } from "../types";

export interface PersistedState {
  providerId: ProviderId;
  modelId: string;
  expectedOutputTokens: number;
  priceOverrides: Record<string, PriceOverride>;
}

export function loadState(context: vscode.ExtensionContext, settings: AnalyzerSettings): PersistedState {
  const raw = context.globalState.get<unknown>(STATE_KEY);
  const stored = isRecord(raw) ? raw : {};
  const providerId = typeof stored.providerId === "string" && isProviderId(stored.providerId)
    ? stored.providerId
    : settings.defaultProvider;
  const requested = typeof stored.modelId === "string" ? getModel(stored.modelId) : undefined;
  const fromSettings = getModel(settings.defaultModel);
  const model = requested && requested.providerId === providerId
    ? requested
    : fromSettings && fromSettings.providerId === providerId
      ? fromSettings
      : defaultModelFor(providerId);
  const expected = typeof stored.expectedOutputTokens === "number"
    ? stored.expectedOutputTokens
    : settings.expectedOutputTokens;

  return {
    providerId,
    modelId: model.id,
    expectedOutputTokens: Number.isFinite(expected) && expected >= 0 ? Math.floor(expected) : settings.expectedOutputTokens,
    priceOverrides: readOverrides(stored.priceOverrides),
  };
}

export async function saveState(context: vscode.ExtensionContext, state: PersistedState): Promise<void> {
  await context.globalState.update(STATE_KEY, state);
}

function readOverrides(value: unknown): Record<string, PriceOverride> {
  if (!isRecord(value)) {
    return {};
  }
  const overrides: Record<string, PriceOverride> = {};
  for (const [modelId, entry] of Object.entries(value)) {
    if (!isRecord(entry)) {
      continue;
    }
    const input = entry.inputPerMillion;
    const output = entry.outputPerMillion;
    if (typeof input === "number" && typeof output === "number" && input >= 0 && output >= 0 && Number.isFinite(input) && Number.isFinite(output)) {
      overrides[modelId] = { inputPerMillion: input, outputPerMillion: output };
    }
  }
  return overrides;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
