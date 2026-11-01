import { describe, expect, it } from "vitest";
import { isEditorScheme, rememberSelection, textFromEditor } from "./editorText";

describe("editor text", () => {
  it("keeps the selection when focus leaves the editor", () => {
    expect(rememberSelection("selected prompt", "", undefined)).toBe("selected prompt");
  });

  it("clears the selection when the user clears it", () => {
    expect(rememberSelection("selected prompt", "", "mouse")).toBe("");
  });

  it("uses the saved selection when the live selection was cleared", () => {
    expect(textFromEditor({
      hasEditor: true,
      documentText: "whole document",
      liveSelection: "",
      selectionSnapshot: "selected prompt",
      source: "selection",
    })).toEqual({ text: "selected prompt", error: null });
  });

  it("reads the document from the tracked editor", () => {
    expect(textFromEditor({
      hasEditor: true,
      documentText: "whole document",
      liveSelection: "",
      selectionSnapshot: "",
      source: "document",
    })).toEqual({ text: "whole document", error: null });
  });

  it("explains a missing editor", () => {
    expect(textFromEditor({
      hasEditor: false,
      documentText: "",
      liveSelection: "",
      selectionSnapshot: "",
      source: "document",
    }).error).toBe("Open a text editor first.");
  });

  it("ignores sidebar and output documents", () => {
    expect(isEditorScheme("file")).toBe(true);
    expect(isEditorScheme("untitled")).toBe(true);
    expect(isEditorScheme("vscode-webview")).toBe(false);
    expect(isEditorScheme("output")).toBe(false);
  });
});
