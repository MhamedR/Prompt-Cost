import { useEffect, useState } from "react";
import { formatPercent, formatTokenCount } from "../analysis/format";
import type { DashboardSnapshot } from "../webview/protocol";
import type { PromptComparison } from "../analysis/compare";
import { isHostMessage, vscodeApi } from "./vscode";

export function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [comparison, setComparison] = useState<PromptComparison | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");

  useEffect(() => {
    const listener = (event: MessageEvent<unknown>): void => {
      if (!isHostMessage(event.data)) {
        return;
      }
      if (event.data.type === "snapshot") {
        setSnapshot(event.data.snapshot);
      } else if (event.data.type === "comparison") {
        setComparison(event.data.result);
        setComparisonError(event.data.error);
      } else if (event.data.type === "compareSeed") {
        if (event.data.side === "left") {
          setLeft(event.data.text);
        } else {
          setRight(event.data.text);
        }
      }
    };
    window.addEventListener("message", listener);
    vscodeApi.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", listener);
  }, []);

  useEffect(() => {
    if (!snapshot || snapshot.focusToken === 0) {
      return;
    }
    document.getElementById("compare")?.scrollIntoView({ block: "nearest" });
  }, [snapshot?.focusToken]);

  if (!snapshot) {
    return <main className="app"><p>Loading PromptCost…</p></main>;
  }

  const activeModel = snapshot.models.find((model) => model.id === snapshot.modelId);

  return (
    <main className="app">
      <header>
        <h1>PromptCost</h1>
        <p>{snapshot.sourceLabel}{snapshot.counting ? " · counting" : ""}</p>
      </header>

      <div className="segmented" role="group" aria-label="Text source">
        {(["auto", "document", "selection"] as const).map((source) => (
          <button
            key={source}
            type="button"
            aria-pressed={snapshot.sourceMode === source}
            onClick={() => vscodeApi.postMessage({ type: "setSource", source })}
          >
            {source === "auto" ? "Auto" : source === "document" ? "Document" : "Selection"}
          </button>
        ))}
      </div>

      <div className="row">
        <label className="field">
          <span>Provider</span>
          <select
            value={snapshot.providerId}
            onChange={(event) => {
              const providerId = event.target.value;
              const first = snapshot.providers.find((provider) => provider.id === providerId);
              if (!first) {
                return;
              }
              vscodeApi.postMessage({
                type: "setModel",
                providerId,
                modelId: snapshot.models.find((model) => model.providerId === providerId)?.id ?? snapshot.modelId,
              });
            }}
          >
            {snapshot.providers.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Model</span>
          <select
            value={snapshot.modelId}
            onChange={(event) => vscodeApi.postMessage({
              type: "setModel",
              providerId: snapshot.providerId,
              modelId: event.target.value,
            })}
          >
            {snapshot.models.map((model) => (
              <option key={model.id} value={model.id}>{model.label}</option>
            ))}
          </select>
        </label>
      </div>

      {activeModel && (
        <section>
          <span className={`badge ${activeModel.accuracy === "exact-local" ? "exact" : activeModel.accuracy === "provider-api" ? "api" : ""}`}>
            {activeModel.accuracyLabel}
          </span>
          <p className="note">{activeModel.compatibility}</p>
          <p className="note">{activeModel.accuracyDetail}</p>
          {activeModel.contextWindow !== undefined && (
            <p className="note">Context window {activeModel.contextWindow.toLocaleString("en-US")} tokens.</p>
          )}
        </section>
      )}

      {snapshot.error && <p className="error">{snapshot.error}</p>}

      {snapshot.analysis && (
        <section>
          <p className="token-count">{formatTokenCount(snapshot.analysis.tokens)}</p>
          <p className="note">{snapshot.analysis.summary}</p>
          <div className="stats">
            <Stat label="Characters" value={formatTokenCount(snapshot.analysis.characters)} />
            <Stat label="Words" value={formatTokenCount(snapshot.analysis.words)} />
            <Stat label="Lines" value={formatTokenCount(snapshot.analysis.lines)} />
            <Stat label="Chars / token" value={snapshot.analysis.charsPerToken} />
          </div>
          {snapshot.analysis.warnings.map((warning) => (
            <p className="warning" key={warning}>{warning}</p>
          ))}
          <h2 className="section-title">Token distribution</h2>
          {snapshot.analysis.distribution.map((share) => (
            <div className="bar-row" key={share.bucket}>
              <span>{share.label}</span>
              <div className="track" aria-hidden="true">
                <div className="fill" style={{ width: `${Math.round(share.share * 100)}%` }} />
              </div>
              <span>{formatTokenCount(share.tokens)}</span>
            </div>
          ))}
          <p className="note">{snapshot.analysis.distributionNote}</p>
        </section>
      )}

      <CostPanel snapshot={snapshot} />
      {snapshot.apiSupported && <ApiPanel snapshot={snapshot} />}
      <ComparePanel
        left={left}
        right={right}
        comparison={comparison}
        error={comparisonError}
        onLeft={setLeft}
        onRight={setRight}
      />
      <p className="footer">{snapshot.disclaimer}</p>
    </main>
  );
}

function Stat(props: { label: string; value: string }): JSX.Element {
  return (
    <div className="stat">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function CostPanel(props: { snapshot: DashboardSnapshot }): JSX.Element {
  const { snapshot } = props;
  const [inputPrice, setInputPrice] = useState(String(snapshot.inputPerMillion));
  const [outputPrice, setOutputPrice] = useState(String(snapshot.outputPerMillion));
  const [outputTokens, setOutputTokens] = useState(String(snapshot.expectedOutputTokens));

  useEffect(() => {
    setInputPrice(String(snapshot.inputPerMillion));
    setOutputPrice(String(snapshot.outputPerMillion));
  }, [snapshot.modelId, snapshot.inputPerMillion, snapshot.outputPerMillion]);

  useEffect(() => {
    setOutputTokens(String(snapshot.expectedOutputTokens));
  }, [snapshot.expectedOutputTokens]);

  return (
    <section className="card">
      <h2 className="section-title">Cost</h2>
      <p className="note">{snapshot.tierNote}</p>
      <p className="note">{snapshot.pricingNotes}</p>
      <div className="costs">
        <label className="price">
          Input $ / 1M
          <input
            inputMode="decimal"
            value={inputPrice}
            onChange={(event) => setInputPrice(event.target.value)}
            onBlur={() => commitPrices(inputPrice, outputPrice)}
          />
        </label>
        <label className="price">
          Output $ / 1M
          <input
            inputMode="decimal"
            value={outputPrice}
            onChange={(event) => setOutputPrice(event.target.value)}
            onBlur={() => commitPrices(inputPrice, outputPrice)}
          />
        </label>
        <label className="price">
          Expected output tokens
          <input
            inputMode="numeric"
            value={outputTokens}
            onChange={(event) => setOutputTokens(event.target.value)}
            onBlur={() => {
              const tokens = Number(outputTokens);
              if (Number.isFinite(tokens) && tokens >= 0) {
                vscodeApi.postMessage({ type: "setExpectedOutputTokens", tokens: Math.floor(tokens) });
              }
            }}
          />
        </label>
      </div>
      <div className="actions">
        <button type="button" onClick={() => vscodeApi.postMessage({ type: "clearPriceOverride" })}>
          Use catalog price
        </button>
      </div>
      {snapshot.analysis && (
        <div className="stats">
          <Stat label="Input cost" value={snapshot.analysis.cost.inputCost} />
          <Stat label="Output cost" value={snapshot.analysis.cost.outputCost} />
          <div className="stat">
            <span>Total</span>
            <strong className="cost-total">{snapshot.analysis.cost.totalCost}</strong>
          </div>
        </div>
      )}
      {snapshot.pricingKind === "unpriced" && !snapshot.usingOverride && (
        <p className="note">This model has no official per-token price. Enter the rate from your inference host.</p>
      )}
    </section>
  );
}

function commitPrices(inputText: string, outputText: string): void {
  const inputPerMillion = Number(inputText);
  const outputPerMillion = Number(outputText);
  if (Number.isFinite(inputPerMillion) && inputPerMillion >= 0 && Number.isFinite(outputPerMillion) && outputPerMillion >= 0) {
    vscodeApi.postMessage({ type: "setPriceOverride", inputPerMillion, outputPerMillion });
  }
}

function ApiPanel(props: { snapshot: DashboardSnapshot }): JSX.Element {
  const { snapshot } = props;
  return (
    <section className="card">
      <h2 className="section-title">Provider API count</h2>
      <p className="note">
        {snapshot.apiEnabled
          ? snapshot.apiKeyStored
            ? "A key is stored locally. Counting still stays on this machine until you send the text."
            : "API counting is enabled, and no key is stored for this provider."
          : "Off. Live counts never leave this machine."}
      </p>
      <div className="actions">
        <button className="primary" type="button" onClick={() => vscodeApi.postMessage({ type: "countWithApi" })}>
          {snapshot.apiCounting ? "Sending…" : "Count with provider API"}
        </button>
      </div>
      {snapshot.apiCount && (
        <p><span className="badge api">Provider API count</span> {formatTokenCount(snapshot.apiCount.count)} tokens. {snapshot.apiCount.summary}</p>
      )}
      {snapshot.apiError && <p className="error">{snapshot.apiError}</p>}
    </section>
  );
}

function ComparePanel(props: {
  left: string;
  right: string;
  comparison: PromptComparison | null;
  error: string | null;
  onLeft: (value: string) => void;
  onRight: (value: string) => void;
}): JSX.Element {
  const { left, right, comparison, error, onLeft, onRight } = props;
  return (
    <section className="compare" id="compare">
      <h2 className="section-title">Compare prompts</h2>
      <label className="field">
        <span>Prompt A</span>
        <textarea value={left} onChange={(event) => onLeft(event.target.value)} />
      </label>
      <div className="actions">
        <button type="button" onClick={() => vscodeApi.postMessage({ type: "seedCompare", side: "left", source: "document" })}>Use document</button>
        <button type="button" onClick={() => vscodeApi.postMessage({ type: "seedCompare", side: "left", source: "selection" })}>Use selection</button>
      </div>
      <label className="field">
        <span>Prompt B</span>
        <textarea value={right} onChange={(event) => onRight(event.target.value)} />
      </label>
      <div className="actions">
        <button type="button" onClick={() => vscodeApi.postMessage({ type: "seedCompare", side: "right", source: "document" })}>Use document</button>
        <button type="button" onClick={() => vscodeApi.postMessage({ type: "seedCompare", side: "right", source: "selection" })}>Use selection</button>
        <button className="primary" type="button" onClick={() => vscodeApi.postMessage({ type: "compare", left, right })}>Compare</button>
      </div>
      {error && <p className="error">{error}</p>}
      {comparison && (
        <div className="card">
          <p>A {formatTokenCount(comparison.leftTokens)} tokens · B {formatTokenCount(comparison.rightTokens)} tokens</p>
          <p>Difference {formatTokenCount(comparison.delta)} tokens ({formatPercent(comparison.savingsPercent)} from A to B).</p>
          <p>{comparison.summary}</p>
        </div>
      )}
    </section>
  );
}
