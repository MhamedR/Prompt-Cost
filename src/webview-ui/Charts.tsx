import { useState } from "react";
import { formatTokenCount, formatUsd } from "../analysis/format";
import type { DashboardSnapshot } from "../webview/protocol";
import type { PromptComparison } from "../analysis/compare";

const TONES = ["tone-0", "tone-1", "tone-2", "tone-3"] as const;

export function CostCharts(props: { snapshot: DashboardSnapshot }): JSX.Element {
  const { snapshot } = props;
  const analysis = snapshot.analysis;
  if (!analysis) {
    return (
      <p className="chart-empty">
        {snapshot.error ?? (snapshot.counting ? "Counting…" : "Enter a prompt to see the charts.")}
      </p>
    );
  }

  const textTokens = Math.max(0, analysis.tokens - analysis.attachmentTokens);
  const tokenRows = [
    meter("Text", textTokens, formatTokenCount(textTokens)),
    meter("Files", analysis.attachmentTokens, formatTokenCount(analysis.attachmentTokens)),
    meter("Output", analysis.cost.outputTokens, formatTokenCount(analysis.cost.outputTokens)),
  ];
  const costRows = [
    meter("Input", analysis.cost.inputAmount, analysis.cost.inputCost),
    meter("Output", analysis.cost.outputAmount, analysis.cost.outputCost),
  ];
  const sizeTiles = [
    { label: "Characters", value: formatTokenCount(analysis.characters) },
    { label: "Words", value: formatTokenCount(analysis.words) },
    { label: "Lines", value: formatTokenCount(analysis.lines) },
    { label: "Chars / token", value: analysis.charsPerToken },
  ];
  const mixRows = analysis.distribution
    .filter((share) => share.tokens > 0)
    .map((share) => meter(
      share.bucket === "code" ? "Code" : share.bucket === "blank" ? "Blank" : "Prose",
      share.tokens,
      formatTokenCount(share.tokens),
    ));

  return (
    <section className="charts" aria-label="Cost">
      <div className="hero">
        <article className="metric-tile">
          <span>Tokens</span>
          <strong>{formatTokenCount(analysis.tokens)}</strong>
        </article>
        <article className="metric-tile">
          <span>Estimated cost</span>
          <strong>{analysis.cost.totalCost}</strong>
        </article>
      </div>
      <p className="note chart-summary">{analysis.summary}</p>

      <ChartCard title="Tokens" tone="tone-0">
        <Meters rows={tokenRows} />
      </ChartCard>
      <ChartCard title="Cost" tone="tone-1">
        <Meters rows={costRows} />
      </ChartCard>
      <ChartCard title="Size" tone="tone-2">
        <div className="metric-grid">
          {sizeTiles.map((tile) => (
            <article className="metric-tile compact" key={tile.label}>
              <span>{tile.label}</span>
              <strong>{tile.value}</strong>
            </article>
          ))}
        </div>
      </ChartCard>
      {mixRows.length > 0 && (
        <ChartCard title="Text" tone="tone-3">
          <Stack rows={mixRows} />
        </ChartCard>
      )}
      {snapshot.pricingKind === "unpriced" && !snapshot.usingOverride && (
        <p className="note">This model has no official per-token price, so the cost chart stays at zero.</p>
      )}
      {analysis.warnings.map((warning) => (
        <p className="warning" key={warning}>{warning}</p>
      ))}
      {snapshot.error && <p className="error">{snapshot.error}</p>}
    </section>
  );
}

export function ComparisonCharts(props: { comparison: PromptComparison }): JSX.Element {
  const { comparison } = props;
  const difference = Math.abs(comparison.savingsTokens);
  const differenceLabel = comparison.savingsTokens > 0 ? "Saved" : comparison.savingsTokens < 0 ? "Added" : "Same";
  const showCost = comparison.leftInputCost > 0 || comparison.rightInputCost > 0;

  return (
    <section className="charts" aria-label="Comparison">
      <div className="hero">
        <article className="metric-tile">
          <span>Current prompt</span>
          <strong>{formatTokenCount(comparison.leftTokens)}</strong>
        </article>
        <article className="metric-tile">
          <span>Compared prompt</span>
          <strong>{formatTokenCount(comparison.rightTokens)}</strong>
        </article>
        <article className="metric-tile">
          <span>{differenceLabel}</span>
          <strong>{formatTokenCount(difference)}</strong>
        </article>
      </div>
      <p className="note chart-summary">{comparison.summary}</p>
      <ChartCard title="Tokens" tone="tone-0">
        <Meters
          rows={[
            meter("Current prompt", comparison.leftTokens, formatTokenCount(comparison.leftTokens)),
            meter("Compared prompt", comparison.rightTokens, formatTokenCount(comparison.rightTokens)),
          ]}
        />
      </ChartCard>
      {showCost && (
        <ChartCard title="Input cost" tone="tone-1">
          <Meters
            rows={[
              meter("Current prompt", comparison.leftInputCost, formatUsd(comparison.leftInputCost)),
              meter("Compared prompt", comparison.rightInputCost, formatUsd(comparison.rightInputCost)),
            ]}
          />
        </ChartCard>
      )}
      {!showCost && (comparison.leftTokens > 0 || comparison.rightTokens > 0) && (
        <p className="note">This model has no input price, so the comparison stays in tokens.</p>
      )}
    </section>
  );
}

function ChartCard(props: { title: string; tone: string; children: JSX.Element | JSX.Element[] }): JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <section className={`chart-card${open ? " open" : ""}`}>
      <button
        className="chart-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="chart-title">
          <i className={`chart-mark ${props.tone}`} aria-hidden="true" />
          <span>{props.title}</span>
        </span>
        <svg className="caret" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path fill="currentColor" d="M2.1 4.1 6 8.1 9.9 4.1 9 3.2 6 6.3 3 3.2z" />
        </svg>
      </button>
      {open && <div className="chart-body">{props.children}</div>}
    </section>
  );
}

function Meters(props: { rows: Meter[] }): JSX.Element {
  const max = Math.max(1, ...props.rows.map((row) => row.value));
  return (
    <div className="meters">
      {props.rows.map((row, index) => (
        <div className="meter" key={row.label}>
          <div className="meter-head">
            <span className="meter-label">
              <i className={`swatch ${TONES[index % TONES.length]}`} aria-hidden="true" />
              <span>{row.label}</span>
            </span>
            <strong>{row.display}</strong>
          </div>
          <div
            className="meter-track"
            role="meter"
            aria-label={row.label}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={row.value}
            aria-valuetext={row.display}
          >
            <span
              className={`meter-fill ${TONES[index % TONES.length]}`}
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Stack(props: { rows: Meter[] }): JSX.Element {
  const total = props.rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <>
      <div className="stack" role="img" aria-label={props.rows.map((row) => `${row.label} ${row.display}`).join(", ")}>
        {props.rows.map((row, index) => (
          <span
            key={row.label}
            className={TONES[index % TONES.length]}
            style={{ width: total === 0 ? "0%" : `${(row.value / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="legend">
        {props.rows.map((row, index) => (
          <li key={row.label}>
            <i className={`swatch ${TONES[index % TONES.length]}`} aria-hidden="true" />
            <span>{row.label}</span>
            <strong>{row.display}</strong>
          </li>
        ))}
      </ul>
    </>
  );
}

interface Meter {
  label: string;
  value: number;
  display: string;
}

function meter(label: string, value: number, display: string): Meter {
  return { label, value: Number.isFinite(value) ? value : 0, display };
}
