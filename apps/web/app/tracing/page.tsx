"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DemoState } from "@/lib/types";

const initial: DemoState = {
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
  flags: { hallucination: false, ragPoisoning: false, vulnerability: false, retrievalDrift: false },
  pipeline: { lastPush: null, deployment: null, trace: null },
  emails: [],
  events: []
};

export default function TracingPage() {
  const [state, setState] = useState<DemoState>(initial);
  const [result, setResult] = useState<string>("No trace sent yet.");

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/state", { cache: "no-store" });
      setState((await response.json()) as DemoState);
    })();
  }, []);

  async function triggerTrace() {
    const response = await fetch("/api/langsmith/trace", { method: "POST" });
    const payload = await response.json();
    setResult(payload.message ?? "Trace processed.");
    const refreshed = await fetch("/api/state", { cache: "no-store" });
    setState((await refreshed.json()) as DemoState);
  }

  const traceStatus = state.pipeline.trace?.status ?? "healthy";

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <h1>skrutai-web / tracing</h1>
          <p>Post-ship LangSmith webhook demo with threshold breach alerting.</p>
        </div>
        <nav className="nav">
          <Link href="/">Home</Link>
          <Link href="/chatbot">Chatbot</Link>
        </nav>
      </header>

      <section className="grid-2">
        <div className="panel">
          <div className="section-title">
            <h3>Webhook contract</h3>
            <span className="badge">POST /api/langsmith/trace</span>
          </div>
          <div className="stack">
            <div className="callout">When post-ship metrics breach threshold, a webhook event is recorded.</div>
            <div className="callout">The alert path sends email to the configured recipient.</div>
            <div className="callout">Use the chatbot flags to force hallucination, poisoning, or security drift.</div>
          </div>
        </div>

        <div className="panel">
          <div className="section-title">
            <h3>Live trace result</h3>
            <span className={`badge ${traceStatus === "breached" ? "bad" : "ok"}`}>{traceStatus}</span>
          </div>
          <div className="metric">
            <div className="label">Status message</div>
            <div className="value" style={{ fontSize: "1rem", lineHeight: 1.6 }}>{result}</div>
          </div>
          <div className="button-row" style={{ marginTop: 12 }}>
            <button className="button" onClick={triggerTrace}>Trigger trace webhook</button>
          </div>
        </div>
      </section>
    </main>
  );
}
