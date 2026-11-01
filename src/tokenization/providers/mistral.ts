import { createRequire } from "node:module";
import { mistralModel } from "../../models/mistral";
import type { TokenizerProvider } from "../../types";
import { UnknownModelError, countResult } from "../result";

interface MistralEncoder {
  encode(text: string, addBos?: boolean, addEos?: boolean): readonly number[];
}

interface MistralModule {
  getTokenizerForModel(model: string): MistralEncoder;
}

const nodeRequire = createRequire(__filename);
const { getTokenizerForModel } = nodeRequire("mistral-tokenizer-ts") as MistralModule;

const cache = new Map<string, MistralEncoder>();

function encoderFor(libraryModel: string): MistralEncoder {
  const cached = cache.get(libraryModel);
  if (cached) {
    return cached;
  }
  const created = getTokenizerForModel(libraryModel);
  cache.set(libraryModel, created);
  return created;
}

export const provider: TokenizerProvider = {
  id: "mistral",
  displayName: "Mistral",
  async countTokens(text, modelId) {
    const model = mistralModel(modelId);
    if (!model) {
      throw new UnknownModelError("Mistral", modelId);
    }
    const tokens = text.length === 0 ? 0 : encoderFor(model.libraryModel).encode(text, false, false).length;
    const summary = model.accuracy === "exact-local"
      ? `Raw text counted with the ${model.libraryModel} tokenizer from mistral-tokenizer-ts. BOS, EOS, and the chat template are not included.`
      : `Counted with the ${model.libraryModel} tokenizer from mistral-tokenizer-ts because ${model.label} does not ship its own vocabulary in that package. Treat the count as approximate.`;
    return countResult(model, tokens, summary);
  },
};
