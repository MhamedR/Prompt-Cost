export type SelectionChangeKind = "keyboard" | "mouse" | "command";

const SKIPPED_SCHEMES = new Set([
  "output",
  "vscode-webview",
  "vscode-scm",
  "comment",
  "debug",
  "vscode-debug",
  "walkThrough",
  "walkThroughSnippet",
  "vscode-notebook-cell-output",
  "vscode-chat-codeblock",
]);

export function isEditorScheme(scheme: string): boolean {
  return !SKIPPED_SCHEMES.has(scheme);
}

export function rememberSelection(previous: string, next: string, kind: SelectionChangeKind | undefined): string {
  if (next.length === 0 && kind === undefined) {
    return previous;
  }
  return next;
}

export function textFromEditor(args: {
  hasEditor: boolean;
  documentText: string;
  liveSelection: string;
  selectionSnapshot: string;
  source: "document" | "selection";
}): { text: string; error: string | null } {
  if (!args.hasEditor) {
    return { text: "", error: "Open a text editor first." };
  }
  if (args.source === "document") {
    if (args.documentText.length === 0) {
      return { text: "", error: "The document is empty." };
    }
    return { text: args.documentText, error: null };
  }
  const text = args.liveSelection.length > 0 ? args.liveSelection : args.selectionSnapshot;
  if (text.length === 0) {
    return { text: "", error: "Select some text in the editor first." };
  }
  return { text, error: null };
}
