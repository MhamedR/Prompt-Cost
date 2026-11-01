import * as vscode from "vscode";
import { AnalyzerController } from "./controller";

let controller: AnalyzerController | undefined;

export function activate(context: vscode.ExtensionContext): void {
  controller = new AnalyzerController(context);
  context.subscriptions.push(controller);
  controller.start();
}

export function deactivate(): void {
  controller = undefined;
}
