export interface TextStats {
  characters: number;
  words: number;
  lines: number;
  charsPerToken: number | null;
}

export function textStats(text: string, tokens: number): TextStats {
  const trimmed = text.trim();
  return {
    characters: text.length,
    words: trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length,
    lines: text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length,
    charsPerToken: tokens > 0 ? text.length / tokens : null,
  };
}
