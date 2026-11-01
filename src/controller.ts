import * as vscode from "vscode";
import { analyzeText } from "./analysis/analyze";
import { compareTokenCounts } from "./analysis/compare";
import { accuracyLabel, formatRatio, formatUsd } from "./analysis/format";
import { countWithProviderApi } from "./api/providerApi";
import { COMMANDS, EDITOR_DISCLAIMER, OUTPUT_CHANNEL, VIEW_ID } from "./constants";
import { registerPromptCostMcpServer, showMcpSetup } from "./mcp/register";
import { readSettings, type AnalyzerSettings } from "./configuration/settings";
import { rememberSelection, textFromEditor, isEditorScheme, type SelectionChangeKind } from "./editorText";
import {
  attachmentKey,
  estimateAttachments,
  sanitizeAttachments,
  textForCounting,
  type AttachmentPayload,
} from "./media/estimate";
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
  private promptText = "";
  private attachments: AttachmentPayload[] = [];
  private promptOrigin: "prompt" | "document" | "selection" = "prompt";
  private queuedPrompt: { text: string; error: string | null } | null = null;
  private trackedEditor: vscode.TextEditor | undefined;
  private selectionSnapshot = "";
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
        if (this.queuedPrompt) {
          this.sidebar.post({ type: "promptText", ...this.queuedPrompt });
        }
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
        void this.useEditor("document");
      }),
      vscode.commands.registerCommand(COMMANDS.analyzeSelection, () => {
        void this.useEditor("selection");
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
      vscode.commands.registerCommand(COMMANDS.configureMcp, () => {
        void showMcpSetup(this.context);
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.noteEditor(editor);
      }),
      vscode.window.onDidChangeVisibleTextEditors(() => {
        this.rememberVisibleEditors();
      }),
      vscode.window.onDidChangeTextEditorSelection((event) => {
        this.noteSelection(event.textEditor, event.kind);
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("promptCost")) {
          this.settings = readSettings();
          this.schedule(true);
        }
      }),
    );
    const mcp = registerPromptCostMcpServer(this.context);
    if (mcp) {
      this.subscriptions.push(mcp);
    }
    this.rememberVisibleEditors();
    this.noteEditor(vscode.window.activeTextEditor);
    if (this.trackedEditor) {
      this.selectionSnapshot = selectedText(this.trackedEditor);
    }
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
    const resolved = this.promptSource();
    const countedText = textForCounting(resolved.text, this.attachments);
    const countedKey = `${model.id}\n${resolved.kind}\n${countedText}\n${attachmentKey(this.attachments)}`;
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
        text: countedText,
        model,
        provider,
        expectedOutputTokens: this.state.expectedOutputTokens,
        maxCharacters: this.settings.maxCharacters,
        ...(priceOverride ? { priceOverride } : {}),
      });
      const media = estimateAttachments({
        providerId: model.providerId,
        modelId: model.id,
        attachments: this.attachments,
      });
      const totalTokens = analysis.tokens.count + media.tokens;
      const cost = calculateCost({
        inputTokens: totalTokens,
        outputTokens: this.state.expectedOutputTokens,
        pricing: model.pricing,
        ...(priceOverride ? { override: priceOverride } : {}),
      });
      const accuracy = media.tokens > 0 ? "approximate" as const : analysis.tokens.accuracy;
      const summary = media.tokens > 0
        ? `${analysis.tokens.summary} Attached files add about ${media.tokens.toLocaleString("en-US")} tokens.`
        : analysis.tokens.summary;
      if (generation !== this.generation) {
        return;
      }
      this.counting = false;
      this.analysisError = null;
      const showCost = analysis.cost.inputPerMillion > 0 || analysis.cost.outputPerMillion > 0 || analysis.cost.usingOverride;
      if (this.settings.statusBarEnabled) {
        this.statusBar.showResult({
          tokens: totalTokens,
          totalCost: cost.totalCost,
          showCost,
          accuracy: accuracyLabel(accuracy),
          modelLabel: model.label,
          summary,
          sourceLabel: this.sourceLabel(resolved.label),
        });
      } else {
        this.statusBar.hide();
      }
      this.analysis = {
        tokens: totalTokens,
        accuracy,
        accuracyLabel: accuracyLabel(accuracy),
        tokenizer: analysis.tokens.tokenizer,
        summary,
        warnings: [...analysis.tokens.warnings, ...media.warnings],
        characters: analysis.textStats.characters,
        words: analysis.textStats.words,
        lines: analysis.textStats.lines,
        charsPerToken: formatRatio(analysis.textStats.charsPerToken),
        distribution: analysis.distribution,
        distributionNote: analysis.distributionNote,
        attachmentTokens: media.tokens,
        cost: {
          inputPerMillion: cost.inputPerMillion,
          outputPerMillion: cost.outputPerMillion,
          inputCost: formatUsd(cost.inputCost),
          outputCost: formatUsd(cost.outputCost),
          totalCost: formatUsd(cost.totalCost),
          inputAmount: cost.inputCost,
          outputAmount: cost.outputCost,
          totalAmount: cost.totalCost,
          inputTokens: cost.inputTokens,
          outputTokens: cost.outputTokens,
          tierNote: cost.tierNote,
          pricingKind: model.pricing.kind,
          pricingNotes: cost.pricingNotes,
          usingOverride: cost.usingOverride,
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
      case "setPrompt":
        this.promptText = message.text;
        this.promptOrigin = "prompt";
        this.queuedPrompt = null;
        this.schedule(true);
        return;
      case "setAttachments":
        this.attachments = sanitizeAttachments(message.attachments, this.settings.maxCharacters);
        this.schedule(true);
        return;
      case "useEditor":
        await this.useEditor(message.source);
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
        await this.compare(message.left, message.right, message.leftAttachments, message.rightAttachments);
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

  private async compare(left: string, right: string, leftAttachments: unknown, rightAttachments: unknown): Promise<void> {
    const leftFiles = sanitizeAttachments(leftAttachments, this.settings.maxCharacters);
    const rightFiles = sanitizeAttachments(rightAttachments, this.settings.maxCharacters);
    if (right.length === 0 && rightFiles.length === 0) {
      this.comparison = { result: null, error: null };
      this.postComparison();
      return;
    }
    const model = this.currentModel();
    const leftText = textForCounting(left, leftFiles);
    const rightText = textForCounting(right, rightFiles);
    try {
      const provider = loadProvider(this.context.extensionPath, model.providerId);
      if (leftText.length > this.settings.maxCharacters || rightText.length > this.settings.maxCharacters) {
        throw new TextTooLongError(Math.max(leftText.length, rightText.length), this.settings.maxCharacters);
      }
      const [leftCount, rightCount] = await Promise.all([
        provider.countTokens(leftText, model.id),
        provider.countTokens(rightText, model.id),
      ]);
      const leftMedia = estimateAttachments({ providerId: model.providerId, modelId: model.id, attachments: leftFiles });
      const rightMedia = estimateAttachments({ providerId: model.providerId, modelId: model.id, attachments: rightFiles });
      const leftTokens = leftCount.count + leftMedia.tokens;
      const rightTokens = rightCount.count + rightMedia.tokens;
      const override = this.overrideFor(model.id);
      const leftCost = calculateCost({
        inputTokens: leftTokens,
        outputTokens: 0,
        pricing: model.pricing,
        ...(override ? { override } : {}),
      });
      const rightCost = calculateCost({
        inputTokens: rightTokens,
        outputTokens: 0,
        pricing: model.pricing,
        ...(override ? { override } : {}),
      });
      this.comparison = {
        result: compareTokenCounts(leftTokens, rightTokens, {
          leftInputCost: leftCost.inputCost,
          rightInputCost: rightCost.inputCost,
        }),
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
    const text = this.promptText;
    if (text.length === 0) {
      void vscode.window.showInformationMessage("Enter a prompt before requesting a provider count.");
      return;
    }
    const confirmed = await vscode.window.showWarningMessage(
      `Send ${text.length.toLocaleString("en-US")} characters of the prompt to ${PROVIDER_LABELS[model.providerId]} for a token count? This extension does not store that text.`,
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
        text,
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

  private async useEditor(source: "document" | "selection"): Promise<void> {
    this.captureEditor();
    const picked = await this.editorText(source);
    await this.reveal();
    if (picked.error) {
      const message = { text: this.promptText, error: picked.error };
      this.queuedPrompt = message;
      this.sidebar.post({ type: "promptText", ...message });
      void vscode.window.showInformationMessage(picked.error);
      return;
    }
    this.promptText = picked.text;
    this.promptOrigin = source;
    const message = { text: picked.text, error: null };
    this.queuedPrompt = message;
    this.sidebar.post({ type: "promptText", ...message });
    this.schedule(true);
  }

  private promptSource(): { text: string; label: string; kind: "document" | "selection" | "prompt" } {
    if (this.promptOrigin === "document") {
      return { text: this.promptText, label: "From document", kind: "document" };
    }
    if (this.promptOrigin === "selection") {
      return { text: this.promptText, label: "From selection", kind: "selection" };
    }
    return { text: this.promptText, label: "Prompt", kind: "prompt" };
  }

  private sourceLabel(label: string): string {
    const count = this.attachments.length;
    if (count === 0) {
      return label;
    }
    return `${label} · ${count} ${count === 1 ? "file" : "files"}`;
  }

  private captureEditor(): void {
    this.rememberVisibleEditors();
    this.noteEditor(vscode.window.activeTextEditor);
    if (!this.trackedEditor) {
      return;
    }
    const live = selectedText(this.trackedEditor);
    if (live.length > 0) {
      this.selectionSnapshot = live;
    }
  }

  private async editorText(source: "document" | "selection"): Promise<{ text: string; error: string | null }> {
    const editor = this.editor();
    if (editor) {
      const live = selectedText(editor);
      if (live.length > 0) {
        this.selectionSnapshot = live;
      }
      return textFromEditor({
        hasEditor: true,
        documentText: editor.document.getText(),
        liveSelection: live,
        selectionSnapshot: this.selectionSnapshot,
        source,
      });
    }
    if (source === "selection" && this.selectionSnapshot.length > 0) {
      return { text: this.selectionSnapshot, error: null };
    }
    const fromTab = await this.textFromOpenTab();
    if (source === "document" && fromTab !== undefined) {
      if (fromTab.length === 0) {
        return { text: "", error: "The document is empty." };
      }
      return { text: fromTab, error: null };
    }
    return textFromEditor({
      hasEditor: false,
      documentText: "",
      liveSelection: "",
      selectionSnapshot: this.selectionSnapshot,
      source,
    });
  }

  private editor(): vscode.TextEditor | undefined {
    const active = vscode.window.activeTextEditor;
    if (active && isCountableDocument(active.document)) {
      this.trackedEditor = active;
      return active;
    }
    const tracked = this.trackedEditor;
    if (tracked && !tracked.document.isClosed && isCountableDocument(tracked.document)) {
      return tracked;
    }
    const visible = vscode.window.visibleTextEditors.find((editor) => isCountableDocument(editor.document));
    if (visible) {
      this.trackedEditor = visible;
      return visible;
    }
    return undefined;
  }

  private rememberVisibleEditors(): void {
    const visible = vscode.window.visibleTextEditors.find((editor) => isCountableDocument(editor.document));
    if (visible) {
      this.trackedEditor = visible;
    }
  }

  private async textFromOpenTab(): Promise<string | undefined> {
    for (const uri of editorTabUris()) {
      const open = vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri.toString());
      try {
        const document = open ?? await vscode.workspace.openTextDocument(uri);
        return document.getText();
      } catch {
        continue;
      }
    }
    return undefined;
  }

  private noteEditor(editor: vscode.TextEditor | undefined): void {
    if (!editor || !isCountableDocument(editor.document)) {
      return;
    }
    this.trackedEditor = editor;
  }

  private noteSelection(editor: vscode.TextEditor, kind: vscode.TextEditorSelectionChangeKind | undefined): void {
    this.noteEditor(editor);
    this.selectionSnapshot = rememberSelection(this.selectionSnapshot, selectedText(editor), selectionKind(kind));
  }

  private overrideFor(modelId: string): PriceOverride | undefined {
    return this.state.priceOverrides[modelId];
  }

  private buildSnapshot(
    model: NonNullable<ReturnType<typeof getModel>>,
    resolved: { text: string; label: string; kind: "document" | "selection" | "prompt" },
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
      sourceLabel: this.sourceLabel(resolved.label),
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
      maxCharacters: this.settings.maxCharacters,
      disclaimer: EDITOR_DISCLAIMER,
    };
  }

  private postSnapshot(): void {
    const generation = ++this.postGeneration;
    const snapshot = this.buildSnapshot(this.currentModel(), this.promptSource(), this.analysis, this.analysisError);
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

function selectionKind(kind: vscode.TextEditorSelectionChangeKind | undefined): SelectionChangeKind | undefined {
  if (kind === vscode.TextEditorSelectionChangeKind.Keyboard) {
    return "keyboard";
  }
  if (kind === vscode.TextEditorSelectionChangeKind.Mouse) {
    return "mouse";
  }
  if (kind === vscode.TextEditorSelectionChangeKind.Command) {
    return "command";
  }
  return undefined;
}

function isCountableDocument(document: vscode.TextDocument): boolean {
  return isEditorScheme(document.uri.scheme);
}

function editorTabUris(): vscode.Uri[] {
  const groups = [vscode.window.tabGroups.activeTabGroup, ...vscode.window.tabGroups.all];
  const seen = new Set<string>();
  const uris: vscode.Uri[] = [];
  for (const group of groups) {
    const tabs = group.activeTab ? [group.activeTab, ...group.tabs] : [...group.tabs];
    for (const tab of tabs) {
      const uri = uriFromTab(tab.input);
      if (!uri || !isEditorScheme(uri.scheme)) {
        continue;
      }
      const key = uri.toString();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      uris.push(uri);
    }
  }
  return uris;
}

function uriFromTab(input: unknown): vscode.Uri | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  if (input instanceof vscode.TabInputText) {
    return input.uri;
  }
  if (input instanceof vscode.TabInputTextDiff) {
    return input.modified;
  }
  if (input instanceof vscode.TabInputNotebook) {
    return input.uri;
  }
  const record = input as { uri?: unknown; modified?: unknown };
  if (record.modified instanceof vscode.Uri) {
    return record.modified;
  }
  if (record.uri instanceof vscode.Uri) {
    return record.uri;
  }
  return undefined;
}

function validPrice(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}
