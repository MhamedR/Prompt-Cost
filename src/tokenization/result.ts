import type { ModelSpec, TokenCountResult } from "../types";

export class UnknownModelError extends Error {
  constructor(provider: string, model: string) {
    super(`${provider} has no tokenizer entry for "${model}".`);
    this.name = "UnknownModelError";
  }
}

export class TextTooLongError extends Error {
  constructor(
    readonly length: number,
    readonly maxCharacters: number,
  ) {
    super(
      `The text is ${length.toLocaleString("en-US")} characters. The limit is ${maxCharacters.toLocaleString("en-US")}. Raise promptCost.maxCharacters to analyze it.`,
    );
    this.name = "TextTooLongError";
  }
}

export function assertWithinLimit(text: string, maxCharacters: number): void {
  if (text.length > maxCharacters) {
    throw new TextTooLongError(text.length, maxCharacters);
  }
}

export function countResult(
  model: ModelSpec,
  count: number,
  summary: string,
): TokenCountResult {
  return {
    count,
    accuracy: model.accuracy,
    tokenizer: model.tokenizer,
    summary,
    warnings: model.warnings ?? [],
  };
}
