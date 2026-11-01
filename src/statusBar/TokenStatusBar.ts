import * as vscode from "vscode";
import { COMMANDS } from "../constants";
import { formatTokenCount, formatUsd } from "../analysis/format";

export class TokenStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = COMMANDS.open;
    this.item.name = "PromptCost";
  }

  showCounting(): void {
    this.item.text = "$(sync~spin) Counting tokens";
    this.item.tooltip = "PromptCost is counting the editor text locally.";
    this.item.show();
  }

  showResult(args: {
    tokens: number;
    totalCost: number;
    showCost: boolean;
    accuracy: string;
    modelLabel: string;
    summary: string;
    sourceLabel: string;
  }): void {
    const cost = args.showCost ? ` · ${formatUsd(args.totalCost)}` : "";
    this.item.text = `$(symbol-numeric) ${formatTokenCount(args.tokens)}${cost}`;
    const tooltip = new vscode.MarkdownString(undefined, true);
    tooltip.appendMarkdown(`**${escapeMarkdown(args.modelLabel)}**\n\n`);
    tooltip.appendMarkdown(`${escapeMarkdown(args.accuracy)} · ${escapeMarkdown(args.sourceLabel)}\n\n`);
    tooltip.appendMarkdown(`${escapeMarkdown(args.summary)}\n\n`);
    tooltip.appendMarkdown("Click to open PromptCost. This is editor text, not the prompt an assistant sends.");
    this.item.tooltip = tooltip;
    this.item.show();
  }

  showError(message: string): void {
    this.item.text = "$(warning) Token count";
    this.item.tooltip = message;
    this.item.show();
  }

  hide(): void {
    this.item.hide();
  }

  dispose(): void {
    this.item.dispose();
  }
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+\-.!|]/g, "\\$&");
}
