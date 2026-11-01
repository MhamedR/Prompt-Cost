/**
 * Local stand-in for DeepSeek V4. The bundled package only has V3 and R1
 * vocabularies, and those are not used here.
 * ASCII is grouped in threes. Each non-ASCII code point is one token.
 */
export function estimateDeepSeekV4Tokens(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  let tokens = 0;
  let index = 0;
  while (index < text.length) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined) {
      break;
    }
    if (codePoint < 128) {
      let chars = 0;
      while (index < text.length && chars < 3) {
        const next = text.codePointAt(index);
        if (next === undefined || next >= 128) {
          break;
        }
        chars += 1;
        index += 1;
      }
      tokens += 1;
      continue;
    }
    tokens += 1;
    index += codePoint > 0xffff ? 2 : 1;
  }
  return tokens;
}
