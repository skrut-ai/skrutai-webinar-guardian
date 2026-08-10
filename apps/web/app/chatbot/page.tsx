"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DemoState, MetricSnapshot } from "@/lib/types";

type ChatReply = {
  answer: string;
  metrics: MetricSnapshot;
  model: string;
  safety: "green" | "degraded";
};

const defaultState: DemoState = {
  config: {
    projectName: "skrutai-web",
    repoName: "repo-x",
    branchName: "main",
    recipientEmail: "demo@skrutai.ai",
    deployUrl: "https://skrutai-web.vercel.app",
    thresholds: {
      hallucination: 0.8,
      ragPrecision: 0.75,
      ragRecall: 0.75,
      security: 0.9
    }
  },
  flags: {
    hallucination: false,
    ragPoisoning: false,
    vulnerability: false,
    retrievalDrift: false
  },
  pipeline: { lastPush: null, deployment: null, trace: null },
  emails: [],
  events: []
};

const flagRows: Array<{
  key: keyof DemoState["flags"];
  label: string;
  detail: string;
}> = [
  { key: "hallucination", label: "Force hallucinated answers", detail: "Drops grounded answer quality." },
  { key: "ragPoisoning", label: "Inject poisoned retrieval", detail: "Damages retrieval precision and recall." },
  { key: "retrievalDrift", label: "Simulate retrieval drift", detail: "Recall falls below threshold." },
  { key: "vulnerability", label: "Trigger security regression", detail: "Security metric falls below threshold." }
];

export default function ChatbotPage() {
  const [state, setState] = useState<DemoState>(defaultState);
  const [question, setQuestion] = useState("How does the bootcamp platform stay safe before and after ship?");
  const [reply, setReply] = useState<ChatReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/state");
      const data = (await response.json()) as DemoState;
      setState(data);
    })();
  }, []);

  const flags = state.flags;
  const canAnswer = true;

  async function saveFlags(nextFlags: DemoState["flags"]) {
    setState((current) => ({ ...current, flags: nextFlags }));
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flags: nextFlags })
    });
  }

  async function simulateAnswer() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/state");
    const data = (await response.json()) as DemoState;
    setState(data);

    const result = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });

    const payload = await result.json();

    if (!result.ok) {
      setError(payload.error ?? "Chat request failed.");
      setReply(null);
      setBusy(false);
      return;
    }

    setReply({
      answer: payload.answer as string,
      metrics: payload.metrics as MetricSnapshot,
      model: payload.model as string,
      safety: payload.safety as "green" | "degraded"
    });
    setBusy(false);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <h1>skrutai-web / chatbot</h1>
          <p>Use flags to show how quality can degrade before or after deployment.</p>
        </div>
        <nav className="nav">
          <Link href="/">Home</Link>
          <Link href="/tracing">Tracing</Link>
        </nav>
      </header>

      <section className="grid-2">
        <div className="panel">
          <div className="section-title">
            <h3>Injection flags</h3>
            <span className="badge warn">Demo controls</span>
          </div>
          <div className="toggle-list">
            {flagRows.map((row) => (
              <label className="toggle" key={row.key}>
                <div>
                  <strong>{row.label}</strong>
                  <div className="muted">{row.detail}</div>
                </div>
                <input
                  type="checkbox"
                  checked={flags[row.key]}
                  onChange={(event) => saveFlags({ ...flags, [row.key]: event.target.checked })}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="section-title">
            <h3>Chat demo</h3>
            <span className={`badge ${flags.hallucination || flags.ragPoisoning || flags.retrievalDrift || flags.vulnerability ? "warn" : "ok"}`}>
              {flags.hallucination || flags.ragPoisoning || flags.retrievalDrift || flags.vulnerability ? "degraded" : "green"}
            </span>
          </div>
          <div className="field">
            <label htmlFor="question">Prompt</label>
            <textarea id="question" rows={5} value={question} onChange={(event) => setQuestion(event.target.value)} />
          </div>
          <div className="button-row" style={{ marginTop: 12 }}>
            <button className="button" onClick={simulateAnswer} disabled={busy || !canAnswer}>
              {busy ? "Running..." : "Generate answer"}
            </button>
          </div>
          {error ? (
            <div className="metric" style={{ marginTop: 16 }}>
              <div className="label">Error</div>
              <div className="value">{error}</div>
            </div>
          ) : null}
          {reply ? (
            <div className="stack" style={{ marginTop: 16 }}>
              <div className="metric">
                <div className="label">Answer</div>
                <div className="value" style={{ fontSize: "1rem", lineHeight: 1.5 }}>{reply.answer}</div>
              </div>
              <div className="metric">
                <div className="label">Model</div>
                <div className="value">{reply.model}</div>
              </div>
              <div className="metric">
                <div className="label">Safety mode</div>
                <div className="value">{reply.safety}</div>
              </div>
              <div className="grid-2">
                {Object.entries(reply.metrics).map(([key, value]) => (
                  <div className="metric" key={key}>
                    <div className="label">{key}</div>
                    <div className="value">{Math.round(value * 100)}%</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
