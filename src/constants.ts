export const VIEW_ID = "promptCost.dashboard";

export const COMMANDS = {
  analyzeDocument: "promptCost.analyzeDocument",
  analyzeSelection: "promptCost.analyzeSelection",
  open: "promptCost.open",
  comparePrompts: "promptCost.comparePrompts",
  countWithProviderApi: "promptCost.countWithProviderApi",
  setApiKey: "promptCost.setApiKey",
  clearApiKey: "promptCost.clearApiKey",
} as const;

export const OUTPUT_CHANNEL = "PromptCost";

export const STATE_KEY = "promptCost.v1";

export const EDITOR_DISCLAIMER =
  "This counts editor text only. It is not the prompt Cursor or another assistant sends. System instructions, rules, tools, images, and chat framing are outside this count.";
