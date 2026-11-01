/**
 * Local stand-in for Llama 4. The Llama 3 tokenizer is intentionally not used.
 * A whitespace run is one token. A letter or number run uses 5-character
 * pieces. Each remaining symbol is its own token.
 */
export function estimateLlama4Tokens(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  let tokens = 0;
  for (const part of text.split(/(\s+)/)) {
    if (part.length === 0) {
      continue;
    }
    if (/^\s+$/.test(part)) {
      tokens += 1;
      continue;
    }
    const matched = /^([\p{L}\p{N}_]*)(.*)$/u.exec(part);
    const head = matched?.[1] ?? "";
    const tail = matched?.[2] ?? part;
    if (head.length > 0) {
      tokens += Math.max(1, Math.ceil(head.length / 5));
    }
    if (tail.length > 0) {
      tokens += tail.length;
    }
  }
  return tokens;
}
