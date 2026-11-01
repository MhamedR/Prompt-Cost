import { useEffect, useState } from "react";
import type { AttachmentPayload } from "../media/estimate";
import type { DashboardSnapshot } from "../webview/protocol";
import type { PromptComparison } from "../analysis/compare";
import { ComparisonCharts, CostCharts } from "./Charts";
import { Composer } from "./Composer";
import { isHostMessage, vscodeApi } from "./vscode";

export function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [comparison, setComparison] = useState<PromptComparison | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [other, setOther] = useState("");
  const [leftFiles, setLeftFiles] = useState<AttachmentPayload[]>([]);
  const [rightFiles, setRightFiles] = useState<AttachmentPayload[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareChartsOpen, setCompareChartsOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [fillError, setFillError] = useState<string | null>(null);

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
      } else if (event.data.type === "promptText") {
        if (event.data.error) {
          setFillError(event.data.error);
          return;
        }
        setFillError(null);
        setPrompt(event.data.text);
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
    setCompareOpen(true);
    document.getElementById("compare")?.scrollIntoView({ block: "nearest" });
  }, [snapshot?.focusToken]);

  useEffect(() => {
    if (!compareOpen) {
      return;
    }
    const handle = window.setTimeout(() => {
      vscodeApi.postMessage({
        type: "compare",
        left: prompt,
        right: other,
        leftAttachments: leftFiles,
        rightAttachments: rightFiles,
      });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [compareOpen, prompt, other, leftFiles, rightFiles, snapshot?.providerId, snapshot?.modelId]);

  if (!snapshot) {
    return <main className="app"><p className="loading">Loading…</p></main>;
  }

  const activeModel = snapshot.models.find((model) => model.id === snapshot.modelId);
  const status = snapshot.sourceLabel === "Prompt" ? null : snapshot.sourceLabel;

  return (
    <main className="app">
      <div className="toolbar">
        <select
          aria-label="Provider"
          value={snapshot.providerId}
          onChange={(event) => {
            const providerId = event.target.value;
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
        <select
          aria-label="Model"
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
      </div>

      {(activeModel || snapshot.counting || status) && (
        <p className="accuracy">
          {activeModel && (
            <span
              className={`badge ${activeModel.accuracy === "exact-local" ? "exact" : activeModel.accuracy === "provider-api" ? "api" : ""}`}
              title={`${activeModel.accuracyLabel}. ${activeModel.compatibility}`}
            >
              {activeModel.accuracyLabel}
            </span>
          )}
          {snapshot.counting && <span className="status">Counting</span>}
          {status && <span className="status">{status}</span>}
        </p>
      )}

      <Composer
        prompt={prompt}
        maxCharacters={snapshot.maxCharacters}
        accent={compareOpen ? "current" : undefined}
        onPrompt={(text) => {
          setPrompt(text);
          setFillError(null);
          vscodeApi.postMessage({ type: "setPrompt", text });
        }}
        onAttachments={(attachments) => {
          setLeftFiles(attachments);
          vscodeApi.postMessage({ type: "setAttachments", attachments });
        }}
      />
      {fillError && <p className="error">{fillError}</p>}

      <div className="actions">
        <button className="text-button" type="button" onClick={() => setCompareOpen((open) => !open)}>
          {compareOpen ? "Hide comparison" : "Compare with another prompt"}
        </button>
        <button
          className="primary"
          type="button"
          aria-pressed={costOpen}
          onClick={() => {
            setCostOpen((open) => !open);
            setCompareChartsOpen(false);
          }}
        >
          Cost
        </button>
      </div>

      {compareOpen && (
        <section className="compare" id="compare">
          <Composer
            prompt={other}
            maxCharacters={snapshot.maxCharacters}
            accent="compared"
            placeholder="Second prompt, or attach a file"
            onPrompt={setOther}
            onAttachments={setRightFiles}
          />
          {comparisonError && <p className="error">{comparisonError}</p>}
          <div className="actions">
            <button
              className="primary"
              type="button"
              aria-pressed={compareChartsOpen}
              onClick={() => {
                setCompareChartsOpen((open) => !open);
                setCostOpen(false);
              }}
            >
              Compare
            </button>
          </div>
          {compareChartsOpen && comparison && (
              <ComparisonCharts comparison={comparison} />
          )}
          {compareChartsOpen && !comparison && !comparisonError && (
            <p className="chart-empty">
              {other.length > 0 || rightFiles.length > 0
                ? "Comparing…"
                : "Enter a second prompt or attach a file, then the comparison charts appear here."}
            </p>
          )}
        </section>
      )}

      {costOpen && !(compareOpen && compareChartsOpen) && <CostCharts snapshot={snapshot} />}
    </main>
  );
}
