export type DistributionBucket = "code" | "prose" | "blank";

export interface DistributionShare {
  bucket: DistributionBucket;
  label: string;
  tokens: number;
  share: number;
}

const BUCKETS: DistributionBucket[] = ["code", "prose", "blank"];

const LABELS: Record<DistributionBucket, string> = {
  code: "Code-like lines",
  prose: "Prose",
  blank: "Blank lines",
};

const CODE_LINE = /[{}();=<>[\]]|^\s*(\/\/|#|import |export |function |class |def |const |let |var |return\b|if\b|for\b|while\b)/;

export function classifyLine(line: string): DistributionBucket {
  if (line.trim().length === 0) {
    return "blank";
  }
  if (CODE_LINE.test(line)) {
    return "code";
  }
  return "prose";
}

export function splitByBucket(text: string): Record<DistributionBucket, string> {
  const groups: Record<DistributionBucket, string[]> = {
    code: [],
    prose: [],
    blank: [],
  };
  if (text.length === 0) {
    return { code: "", prose: "", blank: "" };
  }
  for (const line of text.split(/\r\n|\r|\n/)) {
    groups[classifyLine(line)].push(line);
  }
  return {
    code: groups.code.join("\n"),
    prose: groups.prose.join("\n"),
    blank: groups.blank.join("\n"),
  };
}

export function scaleShares(
  raw: Record<DistributionBucket, number>,
  total: number,
): DistributionShare[] {
  const rawSum = BUCKETS.reduce((sum, bucket) => sum + raw[bucket], 0);
  if (total <= 0 || rawSum <= 0) {
    return BUCKETS.map((bucket) => ({
      bucket,
      label: LABELS[bucket],
      tokens: 0,
      share: 0,
    }));
  }

  const scaled = BUCKETS.map((bucket) => Math.round((raw[bucket] / rawSum) * total));
  const drift = total - scaled.reduce((sum, value) => sum + value, 0);
  let largestIndex = 0;
  for (let index = 1; index < scaled.length; index += 1) {
    if ((scaled[index] ?? 0) > (scaled[largestIndex] ?? 0)) {
      largestIndex = index;
    }
  }
  scaled[largestIndex] = (scaled[largestIndex] ?? 0) + drift;

  return BUCKETS.map((bucket, index) => {
    const tokens = Math.max(0, scaled[index] ?? 0);
    return {
      bucket,
      label: LABELS[bucket],
      tokens,
      share: tokens / total,
    };
  });
}

export const DISTRIBUTION_NOTE =
  "Lines are grouped, tokenized separately, and scaled to the full-text count. A token that would have crossed a line boundary can move between groups.";

export async function tokenDistribution(
  text: string,
  totalTokens: number,
  count: (slice: string) => Promise<number>,
): Promise<DistributionShare[]> {
  const slices = splitByBucket(text);
  const raw: Record<DistributionBucket, number> = {
    code: slices.code.length === 0 ? 0 : await count(slices.code),
    prose: slices.prose.length === 0 ? 0 : await count(slices.prose),
    blank: slices.blank.length === 0 ? 0 : await count(slices.blank),
  };
  return scaleShares(raw, totalTokens);
}
