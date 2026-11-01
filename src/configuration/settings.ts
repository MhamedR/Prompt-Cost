import * as vscode from "vscode";
import type { ProviderId } from "../types";
import { isProviderId } from "../types";
import type { SourceMode } from "../webview/protocol";

export interface AnalyzerSettings {
  defaultProvider: ProviderId;
  defaultModel: string;
  statusBarEnabled: boolean;
  statusBarSource: SourceMode;
  expectedOutputTokens: number;
  maxCharacters: number;
  debounceMs: number;
  apiCountingEnabled: boolean;
}

export function readSettings(): AnalyzerSettings {
  const config = vscode.workspace.getConfiguration("promptCost");
  const provider = config.get<string>("defaultProvider", "openai");
  const source = config.get<string>("statusBar.source", "auto");
  return {
    defaultProvider: isProviderId(provider) ? provider : "openai",
    defaultModel: config.get<string>("defaultModel", "gpt-5.4"),
    statusBarEnabled: config.get<boolean>("statusBar.enabled", true),
    statusBarSource: isSourceMode(source) ? source : "auto",
    expectedOutputTokens: nonNegativeInteger(config.get<number>("expectedOutputTokens", 1024), 1024),
    maxCharacters: Math.max(1000, config.get<number>("maxCharacters", 1_000_000)),
    debounceMs: clamp(config.get<number>("debounceMs", 200), 50, 2000),
    apiCountingEnabled: config.get<boolean>("apiCounting.enabled", false),
  };
}

export function isSourceMode(value: string): value is SourceMode {
  return value === "auto" || value === "document" || value === "selection";
}

function nonNegativeInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.floor(value);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
