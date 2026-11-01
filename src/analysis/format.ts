import type { TokenAccuracy } from "../types";

export function accuracyLabel(accuracy: TokenAccuracy): string {
  switch (accuracy) {
    case "exact-local":
      return "Exact local tokenizer";
    case "provider-api":
      return "Provider API count";
    case "approximate":
      return "Approximate";
  }
}

export function formatTokenCount(count: number): string {
  return Math.round(count).toLocaleString("en-US");
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  if (absolute === 0) {
    return "$0.00";
  }
  if (absolute < 0.000001) {
    return `${sign}<$0.000001`;
  }
  if (absolute < 0.01) {
    return `${sign}$${absolute.toFixed(6)}`;
  }
  if (absolute < 1) {
    return `${sign}$${absolute.toFixed(4)}`;
  }
  return `${sign}$${absolute.toFixed(2)}`;
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString("en-US")}%`;
}

export function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
