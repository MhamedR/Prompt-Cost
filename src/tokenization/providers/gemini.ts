import { geminiModel } from "../../models/gemini";
import type { TokenizerProvider } from "../../types";
import { UnknownModelError, countResult } from "../result";
import { estimateGeminiTokens } from "./geminiEstimator";

export const provider: TokenizerProvider = {
  id: "gemini",
  displayName: "Google Gemini",
  async countTokens(text, modelId) {
    const model = geminiModel(modelId);
    if (!model) {
      throw new UnknownModelError("Google Gemini", modelId);
    }
    return countResult(
      model,
      estimateGeminiTokens(text),
      "Approximate local estimate for Gemini text. It is not Google's tokenizer. countTokens is authoritative and is not called unless you explicitly send this text.",
    );
  },
};
