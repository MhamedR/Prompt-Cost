import { countTokens } from "@cyberlangke/tokkit-deepseek";
import { deepSeekModel } from "../../models/deepseek";
import type { TokenizerProvider } from "../../types";
import { UnknownModelError, countResult } from "../result";
import { estimateDeepSeekV4Tokens } from "./deepseekEstimator";

export const provider: TokenizerProvider = {
  id: "deepseek",
  displayName: "DeepSeek",
  async countTokens(text, modelId) {
    const model = deepSeekModel(modelId);
    if (!model) {
      throw new UnknownModelError("DeepSeek", modelId);
    }
    if (!model.family) {
      return countResult(
        model,
        estimateDeepSeekV4Tokens(text),
        "Approximate byte-oriented estimate for DeepSeek V4. The bundled V3 and R1 vocabularies are not used.",
      );
    }
    const tokens = text.length === 0
      ? 0
      : await countTokens(text, model.family, { addSpecialTokens: false });
    return countResult(
      model,
      tokens,
      `Raw text counted with the ${model.family} tokenizer from @cyberlangke/tokkit-deepseek. Special tokens are not added.`,
    );
  },
};
