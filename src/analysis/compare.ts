import { formatPercent, formatTokenCount } from "./format";

export interface PromptComparison {
  leftTokens: number;
  rightTokens: number;
  delta: number;
  savingsTokens: number;
  savingsPercent: number | null;
  summary: string;
}

export function compareTokenCounts(leftTokens: number, rightTokens: number): PromptComparison {
  const delta = rightTokens - leftTokens;
  const savingsTokens = leftTokens - rightTokens;
  const savingsPercent = leftTokens === 0 ? null : (savingsTokens / leftTokens) * 100;
  return {
    leftTokens,
    rightTokens,
    delta,
    savingsTokens,
    savingsPercent,
    summary: comparisonSummary(leftTokens, rightTokens, savingsTokens, savingsPercent),
  };
}

function comparisonSummary(
  leftTokens: number,
  rightTokens: number,
  savingsTokens: number,
  savingsPercent: number | null,
): string {
  if (leftTokens === 0 && rightTokens === 0) {
    return "Both prompts are empty.";
  }
  if (savingsTokens > 0) {
    return `Prompt B is ${formatPercent(savingsPercent)} smaller (${formatTokenCount(savingsTokens)} tokens saved against A).`;
  }
  if (savingsTokens < 0) {
    const increase = leftTokens === 0 ? null : (Math.abs(savingsTokens) / leftTokens) * 100;
    return `Prompt B is ${formatPercent(increase)} larger (${formatTokenCount(Math.abs(savingsTokens))} extra tokens against A).`;
  }
  return "Both prompts use the same number of tokens.";
}
