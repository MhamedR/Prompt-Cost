import * as path from "node:path";
import * as vscode from "vscode";
import { analyzeText } from "./analysis/analyze";
import { compareTokenCounts } from "./analysis/compare";
import { accuracyLabel, formatRatio, formatUsd } from "./analysis/format";
import { countWithProviderApi } from "./api/providerApi";
import { COMMANDS, EDITOR_DISCLAIMER, OUTPUT_CHANNEL, VIEW_ID } from "./constants";
import { readSettings, type AnalyzerSettings } from "./configuration/settings";
import { PROVIDER_LABELS, defaultModelFor, getModel, modelsForProvider } from "./models/catalog";
import { calculateCost, selectTier } from "./pricing/calculator";
import { apiProviderId, secretKey, type ApiProviderId } from "./secrets/apiKeys";
import { SidebarProvider } from "./sidebar/SidebarProvider";
import { loadState, saveState, type PersistedState } from "./state/persistedState";
import { TokenStatusBar } from "./statusBar/TokenStatusBar";
import { loadProvider } from "./tokenization/registry";
import { TextTooLongError } from "./tokenization/result";
import type { ModelSpec, PriceOverride, ProviderId } from "./types";
import { isProviderId } from "./types";
import type { DashboardSnapshot, ModelView, SourceMode, WebviewToHost } from "./webview/protocol";
import { isSourceMode } from "./configuration/settings";

export class AnalyzerController implements vscode.Disposable {
  private readonly statusBar = new TokenStatusBar();
  private readonly output: vscode.OutputChannel;
  private readonly sidebar: SidebarProvider;
  private readonly subscriptions: vscode.Disposable[] = [];
  private settings: AnalyzerSettings;
  private state: PersistedState;
  private sourceMode: SourceMode;
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private focusToken = 0;
  private apiCount: DashboardSnapshot["apiCount"] = null;
  private apiError: string | null = null;
  private apiCounting = false;
  private counting = false;
  private analysis: DashboardSnapshot["analysis"] = null;
  private analysisError: string | null = null;
  private postGeneration = 0;
  private countedKey = "";
  private comparison: { result: ReturnType<typeof compareTokenCounts> | null; error: string | null } = {
    result: null,
    error: null,
  };

  constructor(private readonly context: vscode.ExtensionContext) {
    this.output = vscode.window.createOutputChannel(OUTPUT_CHANNEL);
    this.settings = readSettings();
    this.state = loadState(context, this.settings);
    this.sourceMode = this.settings.statusBarSource;
    this.sidebar = new SidebarProvider(
      context.extensionUri,
      (message) => {
        void this.onMessage(message);
      },
      () => {
        this.postSnapshot();
        this.postComparison();
      },
    );
  }

  start(): void {
    this.subscriptions.push(
      this.statusBar,
      this.output,
      this.sidebar,
      vscode.window.registerWebviewViewProvider(VIEW_ID, this.sidebar, {
        webviewOptions: { retainContextWhenHidden: true },
      }),
      vscode.commands.registerCommand(COMMANDS.analyzeDocument, () => {
        this.sourceMode = "document";
        void this.reveal();
        this.schedule(true);
      }),
      vscode.commands.registerCommand(COMMANDS.analyzeSelection, () => {
        this.sourceMode = "selection";
        void this.reveal();
        this.schedule(true);
      }),
      vscode.commands.registerCommand(COMMANDS.open, () => {
        void this.reveal();
      }),
      vscode.commands.registerCommand(COMMANDS.comparePrompts, () => {
        this.focusToken += 1;
        void this.reveal();
        this.postSnapshot();
      }),
      vscode.commands.registerCommand(COMMANDS.countWithProviderApi, () => {
        void this.countWithApi();
      }),
      vscode.commands.registerCommand(COMMANDS.setApiKey, () => {
        void this.storeApiKey();
      }),
      vscode.commands.registerCommand(COMMANDS.clearApiKey, () => {
        void this.clearApiKey();
      }),
      vscode.window.onDidChangeActiveTextEditor(() => this.schedule(false)),
      vscode.window.onDidChangeTextEditorSelection(() => this.schedule(false)),
      vscode.workspace.onDidChangeTextDocument((event) => {
        const active = vscode.window.activeTextEditor;
        if (active && event.document === active.document) {
          this.schedule(false);
        }
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("promptCost")) {
          this.settings = readSettings();
          this.schedule(true);
        }
      }),
    );
    this.schedule(true);
  }

  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
  }

  private async reveal(): Promise<void> {
    await vscode.commands.executeCommand(`${VIEW_ID}.focus`);
  }

  private schedule(immediate: boolean): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    const delay = immediate ? 0 : this.settings.debounceMs;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.recount();
    }, delay);
  }

  private async recount(): Promise<void> {
    const generation = ++this.generation;
    const model = this.currentModel();
    const resolved = this.resolveText();
    const countedKey = `${model.id}\n${resolved.kind}\n${resolved.text}`;
    if (countedKey !== this.countedKey) {
      const modelChanged = !this.countedKey.startsWith(`${model.id}\n`);
      this.apiCount = null;
      this.apiError = null;
      if (modelChanged) {
        this.analysis = null;
        this.analysisError = null;
      }
      this.countedKey = countedKey;
    }
    if (!this.settings.statusBarEnabled) {
      this.statusBar.hide();
    } else if (!this.analysis) {
      this.statusBar.showCounting();
    }
    this.counting = true;
    this.postSnapshot();

    try {
      const provider = loadProvider(this.context.extensionPath, model.providerId);
      const priceOverride = this.overrideFor(model.id);
      const analysis = await analyzeText({
        text: resolved.text,
        model,
        provider,
        expectedOutputTokens: this.state.expectedOutputTokens,
        maxCharacters: this.settings.maxCharacters,
        ...(priceOverride ? { priceOverride } : {}),
      });
      if (generation !== this.generation) {
        return;
      }
      this.counting = false;
      this.analysisError = null;
      const showCost = analysis.cost.inputPerMillion > 0 || analysis.cost.outputPerMillion > 0 || analysis.cost.usingOverride;
      if (this.settings.statusBarEnabled) {
        this.statusBar.showResult({
          tokens: analysis.tokens.count,
          totalCost: analysis.cost.totalCost,
          showCost,
          accuracy: accuracyLabel(analysis.tokens.accuracy),
          modelLabel: model.label,
          summary: analysis.tokens.summary,
          sourceLabel: resolved.label,
        });
      } else {
        this.statusBar.hide();
      }
      this.analysis = {
        tokens: analysis.tokens.count,
        accuracy: analysis.tokens.accuracy,
        accuracyLabel: accuracyLabel(analysis.tokens.accuracy),
        tokenizer: analysis.tokens.tokenizer,
        summary: analysis.tokens.summary,
        warnings: analysis.tokens.warnings,
        characters: analysis.textStats.characters,
        words: analysis.textStats.words,
        lines: analysis.textStats.lines,
        charsPerToken: formatRatio(analysis.textStats.charsPerToken),
        distribution: analysis.distribution,
        distributionNote: analysis.distributionNote,
        cost: {
          inputPerMillion: analysis.cost.inputPerMillion,
          outputPerMillion: analysis.cost.outputPerMillion,
          inputCost: formatUsd(analysis.cost.inputCost),
          outputCost: formatUsd(analysis.cost.outputCost),
          totalCost: formatUsd(analysis.cost.totalCost),
          inputTokens: analysis.cost.inputTokens,
          outputTokens: analysis.cost.outputTokens,
          tierNote: analysis.cost.tierNote,
          pricingKind: model.pricing.kind,
          pricingNotes: analysis.cost.pricingNotes,
          usingOverride: analysis.cost.usingOverride,
        },
      };
      this.postSnapshot();
    } catch (error) {
      if (generation !== this.generation) {
        return;
      }
      this.counting = false;
      this.analysis = null;
      const message = error instanceof TextTooLongError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Token counting failed.";
      this.output.appendLine(message);
      if (this.settings.statusBarEnabled) {
        this.statusBar.showError(message);
      } else {
        this.statusBar.hide();
      }
      this.analysisError = message;
      this.postSnapshot();
    }
  }

  private async onMessage(message: WebviewToHost): Promise<void> {
    switch (message.type) {
      case "ready":
        this.postSnapshot();
        this.postComparison();
        return;
      case "setModel": {
        if (!isProviderId(message.providerId)) {
          return;
        }
        const requested = getModel(message.modelId);
        const model = requested?.providerId === message.providerId
          ? requested
          : defaultModelFor(message.providerId);
        await this.setModel(message.providerId, model.id);
        return;
      }
      case "setSource":
        if (isSourceMode(message.source)) {
          this.sourceMode = message.source;
          this.schedule(true);
        }
        return;
      case "setExpectedOutputTokens":
        if (Number.isFinite(message.tokens) && message.tokens >= 0) {
          this.state.expectedOutputTokens = Math.floor(message.tokens);
          await saveState(this.context, this.state);
          this.schedule(true);
        }
        return;
      case "setPriceOverride":
        if (validPrice(message.inputPerMillion) && validPrice(message.outputPerMillion)) {
          this.state.priceOverrides[this.state.modelId] = {
            inputPerMillion: message.inputPerMillion,
            outputPerMillion: message.outputPerMillion,
          };
          await saveState(this.context, this.state);
          this.schedule(true);
        }
        return;
      case "clearPriceOverride": {
        delete this.state.priceOverrides[this.state.modelId];
        await saveState(this.context, this.state);
        this.schedule(true);
        return;
      }
      case "compare":
        await this.compare(message.left, message.right);
        return;
      case "seedCompare":
        this.sidebar.post({
          type: "compareSeed",
          side: message.side,
          text: this.textFor(message.source),
        });
        return;
      case "countWithApi":
        await this.countWithApi();
        return;
      default:
        return;
    }
  }

  private async setModel(providerId: ProviderId, modelId: string): Promise<void> {
    const model = getModel(modelId);
    if (!model || model.providerId !== providerId) {
      return;
    }
    this.state.providerId = providerId;
    this.state.modelId = model.id;
    await saveState(this.context, this.state);
    this.schedule(true);
  }

  private async compare(left: string, right: string): Promise<void> {
    const model = this.currentModel();
    try {
      const provider = loadProvider(this.context.extensionPath, model.providerId);
      if (left.length > this.settings.maxCharacters || right.length > this.settings.maxCharacters) {
        throw new TextTooLongError(Math.max(left.length, right.length), this.settings.maxCharacters);
      }
      const [leftCount, rightCount] = await Promise.all([
        provider.countTokens(left, model.id),
        provider.countTokens(right, model.id),
      ]);
      this.comparison = {
        result: compareTokenCounts(leftCount.count, rightCount.count),
        error: null,
      };
    } catch (error) {
      this.comparison = {
        result: null,
        error: error instanceof Error ? error.message : "Comparison failed.",
      };
    }
    this.postComparison();
  }

  private async countWithApi(): Promise<void> {
    const model = this.currentModel();
    const apiProvider = apiProviderId(model.providerId);
    if (!apiProvider || !model.supportsApiCount || !model.apiModelId) {
      void vscode.window.showInformationMessage("The selected model has no provider token-count API in this extension.");
      return;
    }
    if (!this.settings.apiCountingEnabled) {
      const choice = await vscode.window.showWarningMessage(
        "Provider API counts are off. Live counting stays on this machine. Turn on API counting only if an explicit action may send editor text to the provider.",
        "Open Settings",
      );
      if (choice === "Open Settings") {
        await vscode.commands.executeCommand("workbench.action.openSettings", "promptCost.apiCounting.enabled");
      }
      return;
    }
    const apiKey = await this.context.secrets.get(secretKey(apiProvider));
    if (!apiKey) {
      const choice = await vscode.window.showInformationMessage(
        `Store a ${PROVIDER_LABELS[model.providerId]} API key in the extension secret store to request a count.`,
        "Store Key",
      );
      if (choice === "Store Key") {
        await this.promptForKey(apiProvider);
      }
      return;
    }
    const resolved = this.resolveText();
    const confirmed = await vscode.window.showWarningMessage(
      `Send ${resolved.text.length.toLocaleString("en-US")} characters of editor text to ${PROVIDER_LABELS[model.providerId]} for a token count? This extension does not store that text.`,
      { modal: true },
      "Send",
    );
    if (confirmed !== "Send") {
      return;
    }
    this.apiCounting = true;
    this.apiError = null;
    this.postSnapshot();
    try {
      const result = await countWithProviderApi({
        providerId: apiProvider,
        modelId: model.apiModelId,
        text: resolved.text,
        apiKey,
      });
      this.apiCount = result;
      this.apiError = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The token-count request failed.";
      this.apiError = message.includes(apiKey) ? "The token-count request failed before a count was returned." : message;
      this.output.appendLine(this.apiError);
    } finally {
      this.apiCounting = false;
      this.postSnapshot();
    }
  }

  private async storeApiKey(): Promise<void> {
    const picked = await vscode.window.showQuickPick(
      [
        { label: "Anthropic", id: "anthropic" as const },
        { label: "Google Gemini", id: "gemini" as const },
      ],
      { placeHolder: "Which provider key should be stored locally?" },
    );
    if (!picked) {
      return;
    }
    await this.promptForKey(picked.id);
  }

  private async promptForKey(providerId: ApiProviderId): Promise<void> {
    const value = await vscode.window.showInputBox({
      title: `Store ${providerId === "anthropic" ? "Anthropic" : "Gemini"} API key`,
      prompt: "The key is saved in VS Code's secret store. It is not written to settings or sent to the webview.",
      password: true,
      ignoreFocusOut: true,
    });
    if (!value || value.trim().length === 0) {
      return;
    }
    await this.context.secrets.store(secretKey(providerId), value.trim());
    void vscode.window.showInformationMessage("API key stored locally.");
    this.postSnapshot();
  }

  private async clearApiKey(): Promise<void> {
    const picked = await vscode.window.showQuickPick(
      [
        { label: "Anthropic", id: "anthropic" as const },
        { label: "Google Gemini", id: "gemini" as const },
      ],
      { placeHolder: "Which stored key should be deleted?" },
    );
    if (!picked) {
      return;
    }
    await this.context.secrets.delete(secretKey(picked.id));
    void vscode.window.showInformationMessage("Stored API key deleted.");
    this.postSnapshot();
  }

  private currentModel(): ModelSpec {
    const model = getModel(this.state.modelId) ?? modelsForProvider(this.state.providerId)[0];
    if (!model) {
      throw new Error("The model catalog is empty.");
    }
    return model;
  }

  private overrideFor(modelId: string): PriceOverride | undefined {
    return this.state.priceOverrides[modelId];
  }

  private resolveText(): { text: string; label: string; kind: "document" | "selection" | "none" } {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return { text: "", label: "No active editor", kind: "none" };
    }
    const name = path.basename(editor.document.fileName);
    if (this.sourceMode === "document") {
      return { text: editor.document.getText(), label: name, kind: "document" };
    }
    if (this.sourceMode === "selection") {
      return { text: selectedText(editor), label: "Selection", kind: "selection" };
    }
    const selection = selectedText(editor);
    if (selection.length > 0) {
      return { text: selection, label: "Selection", kind: "selection" };
    }
    return { text: editor.document.getText(), label: name, kind: "document" };
  }

  private textFor(source: "document" | "selection"): string {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return "";
    }
    return source === "document" ? editor.document.getText() : selectedText(editor);
  }

  private buildSnapshot(
    model: NonNullable<ReturnType<typeof getModel>>,
    resolved: { text: string; label: string; kind: "document" | "selection" | "none" },
    analysis: DashboardSnapshot["analysis"],
    error: string | null,
  ): DashboardSnapshot {
    const inputTokens = analysis?.tokens ?? 0;
    const tier = selectTier(model.pricing.tiers, inputTokens);
    const override = this.overrideFor(model.id);
    const preview = calculateCost({
      inputTokens,
      outputTokens: this.state.expectedOutputTokens,
      pricing: model.pricing,
      ...(override ? { override } : {}),
    });
    const models = modelsForProvider(model.providerId).map((entry): ModelView => ({
      id: entry.id,
      label: entry.label,
      providerId: entry.providerId,
      tokenizer: entry.tokenizer,
      accuracy: entry.accuracy,
      accuracyLabel: accuracyLabel(entry.accuracy),
      accuracyDetail: entry.accuracyDetail,
      compatibility: entry.compatibility,
      ...(entry.contextWindow !== undefined ? { contextWindow: entry.contextWindow } : {}),
      pricingKind: entry.pricing.kind,
      pricingNotes: entry.pricing.notes,
      pricingSource: entry.pricing.source,
      inputPerMillion: entry.pricing.tiers[0]?.inputPerMillion ?? 0,
      outputPerMillion: entry.pricing.tiers[0]?.outputPerMillion ?? 0,
    }));
    return {
      providerId: model.providerId,
      modelId: model.id,
      providers: (Object.keys(PROVIDER_LABELS) as ProviderId[]).map((id) => ({
        id,
        label: PROVIDER_LABELS[id],
      })),
      models,
      sourceMode: this.sourceMode,
      resolvedSource: resolved.kind,
      sourceLabel: resolved.label,
      analysis,
      error,
      counting: this.counting,
      expectedOutputTokens: this.state.expectedOutputTokens,
      inputPerMillion: preview.inputPerMillion,
      outputPerMillion: preview.outputPerMillion,
      usingOverride: preview.usingOverride,
      pricingKind: model.pricing.kind,
      pricingNotes: model.pricing.notes,
      tierNote: preview.tierNote,
      apiSupported: model.supportsApiCount,
      apiEnabled: this.settings.apiCountingEnabled,
      apiKeyStored: false,
      apiCounting: this.apiCounting,
      apiCount: this.apiCount,
      apiError: this.apiError,
      focusToken: this.focusToken,
      disclaimer: EDITOR_DISCLAIMER,
    };
  }

  private postSnapshot(): void {
    const generation = ++this.postGeneration;
    const snapshot = this.buildSnapshot(this.currentModel(), this.resolveText(), this.analysis, this.analysisError);
    void this.attachKeyFlag(snapshot).then((withKey) => {
      if (generation === this.postGeneration) {
        this.sidebar.post({ type: "snapshot", snapshot: withKey });
      }
    });
  }

  private async attachKeyFlag(snapshot: DashboardSnapshot): Promise<DashboardSnapshot> {
    const apiProvider = apiProviderId(snapshot.providerId);
    if (!apiProvider) {
      return { ...snapshot, apiKeyStored: false };
    }
    const key = await this.context.secrets.get(secretKey(apiProvider));
    return { ...snapshot, apiKeyStored: Boolean(key) };
  }

  private postComparison(): void {
    this.sidebar.post({
      type: "comparison",
      result: this.comparison.result,
      error: this.comparison.error,
    });
  }
}

function selectedText(editor: vscode.TextEditor): string {
  return editor.selections
    .filter((selection) => !selection.isEmpty)
    .map((selection) => editor.document.getText(selection))
    .join("\n");
}

function validPrice(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}
