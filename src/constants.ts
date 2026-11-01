export const VIEW_ID = "promptCost.dashboard";

export const COMMANDS = {
  analyzeDocument: "promptCost.analyzeDocument",
  analyzeSelection: "promptCost.analyzeSelection",
  open: "promptCost.open",
  comparePrompts: "promptCost.comparePrompts",
  countWithProviderApi: "promptCost.countWithProviderApi",
  setApiKey: "promptCost.setApiKey",
  clearApiKey: "promptCost.clearApiKey",
  configureMcp: "promptCost.configureMcp",
} as const;

export const OUTPUT_CHANNEL = "Prompt Cost";

export const STATE_KEY = "promptCost.v1";

export const EDITOR_DISCLAIMER =
  "This counts the prompt in the box and the files attached to it. It is not the full prompt an assistant sends. System instructions, rules, tools, and chat framing stay outside this count. Image, video, audio, and unparsed documents use the provider's published size rules and are approximate.";
