import { Tokenizer, type Encoding } from "ai-tokenizer";
import * as claudeEncoding from "ai-tokenizer/encoding/claude";
import { anthropicModel } from "../../models/anthropic";
import type { TokenizerProvider } from "../../types";
import { UnknownModelError, countResult } from "../result";

const claude = new Tokenizer(claudeEncoding as Encoding);

export const provider: TokenizerProvider = {
  id: "anthropic",
  displayName: "Anthropic",
  async countTokens(text, modelId) {
    const model = anthropicModel(modelId);
    if (!model) {
      throw new UnknownModelError("Anthropic", modelId);
    }
    return countResult(
      model,
      text.length === 0 ? 0 : claude.count(text),
      "Raw text counted with the Claude encoding from ai-tokenizer. This is not Anthropic's count_tokens API. Message framing, tools, and images are not included.",
    );
  },
};
