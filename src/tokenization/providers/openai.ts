import { countTokens as countCl100k } from "gpt-tokenizer/encoding/cl100k_base";
import { countTokens as countO200k } from "gpt-tokenizer/encoding/o200k_base";
import { openAiModel } from "../../models/openai";
import type { TokenizerProvider } from "../../types";
import { UnknownModelError, countResult } from "../result";

const encodeOptions = { disallowedSpecial: new Set<string>() };

function count(text: string, encoding: string): number {
  if (encoding === "cl100k_base") {
    return countCl100k(text, encodeOptions);
  }
  if (encoding === "o200k_base") {
    return countO200k(text, encodeOptions);
  }
  throw new Error(`Unsupported OpenAI encoding "${encoding}".`);
}

export const provider: TokenizerProvider = {
  id: "openai",
  displayName: "OpenAI",
  async countTokens(text, modelId) {
    const model = openAiModel(modelId);
    if (!model) {
      throw new UnknownModelError("OpenAI", modelId);
    }
    const tokens = count(text, model.tokenizer);
    return countResult(
      model,
      tokens,
      `Raw text counted with OpenAI ${model.tokenizer} via gpt-tokenizer. Message framing, tools, images, and audio are not included.`,
    );
  },
};
