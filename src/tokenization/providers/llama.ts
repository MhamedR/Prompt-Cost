import llama3Tokenizer from "llama3-tokenizer-js";
import { llamaModel } from "../../models/llama";
import type { TokenizerProvider } from "../../types";
import { UnknownModelError, countResult } from "../result";
import { estimateLlama4Tokens } from "./llama4Estimator";

export const provider: TokenizerProvider = {
  id: "llama",
  displayName: "Meta Llama",
  async countTokens(text, modelId) {
    const model = llamaModel(modelId);
    if (!model) {
      throw new UnknownModelError("Meta Llama", modelId);
    }
    if (model.tokenizer === "llama3") {
      const tokens = text.length === 0 ? 0 : llama3Tokenizer.encode(text, { bos: false, eos: false }).length;
      return countResult(
        model,
        tokens,
        "Raw text counted with the Llama 3 tokenizer from llama3-tokenizer-js. BOS, EOS, and the chat template are not included.",
      );
    }
    return countResult(
      model,
      estimateLlama4Tokens(text),
      "Approximate local estimate for Llama 4. The Llama 3 tokenizer is not used, and Meta's Llama 4 vocabulary is not bundled.",
    );
  },
};
