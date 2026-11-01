function codePointAt(text: string, index: number): number {
  const value = text.codePointAt(index);
  if (value === undefined) {
    throw new Error("Character index is outside the text.");
  }
  return value;
}

function charWidth(codePoint: number): number {
  return codePoint > 0xffff ? 2 : 1;
}

function isCjk(codePoint: number): boolean {
  return (
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x3040 && codePoint <= 0x30ff) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7af)
  );
}

function isAsciiWhitespace(codePoint: number): boolean {
  return codePoint === 9 || codePoint === 10 || codePoint === 13 || codePoint === 32;
}

function isAsciiAlnum(codePoint: number): boolean {
  return (
    (codePoint >= 48 && codePoint <= 57) ||
    (codePoint >= 65 && codePoint <= 90) ||
    (codePoint >= 97 && codePoint <= 122)
  );
}

function isAsciiPunct(codePoint: number): boolean {
  return codePoint < 128 && !isAsciiWhitespace(codePoint) && !isAsciiAlnum(codePoint);
}

/**
 * Local stand-in for Gemini text. Google's countTokens API is the real count.
 * English words use a 4-character piece, CJK and Hangul are one piece each,
 * and each whitespace run or ASCII punctuation mark is its own piece.
 */
export function estimateGeminiTokens(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  let tokens = 0;
  let index = 0;
  while (index < text.length) {
    const codePoint = codePointAt(text, index);
    if (isCjk(codePoint)) {
      tokens += 1;
      index += charWidth(codePoint);
      continue;
    }
    if (isAsciiWhitespace(codePoint)) {
      while (index < text.length && isAsciiWhitespace(codePointAt(text, index))) {
        index += charWidth(codePointAt(text, index));
      }
      tokens += 1;
      continue;
    }
    if (isAsciiPunct(codePoint)) {
      tokens += 1;
      index += 1;
      continue;
    }
    if (codePoint < 128 && isAsciiAlnum(codePoint)) {
      let chars = 0;
      while (index < text.length) {
        const next = codePointAt(text, index);
        if (next > 127 || !isAsciiAlnum(next)) {
          break;
        }
        chars += 1;
        index += 1;
      }
      tokens += Math.max(1, Math.ceil(chars / 4));
      continue;
    }
    let chars = 0;
    while (index < text.length) {
      const next = codePointAt(text, index);
      if (next < 128 || isCjk(next)) {
        break;
      }
      chars += 1;
      index += charWidth(next);
    }
    tokens += Math.max(1, Math.ceil(chars / 2));
  }
  return tokens;
}
