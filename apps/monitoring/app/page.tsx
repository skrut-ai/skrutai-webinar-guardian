"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DemoState } from "@/lib/core";

const emptyState: DemoState = {
  config: {
    projectName: "skrutai-monitoring",
    repoName: "repo-x",
    branchName: "main",
    recipientEmail: "demo@skrutai.ai",
    deployUrl: "https://skrutai-monitoring.vercel.app",
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

export default function MonitoringHomePage() {
  const [state, setState] = useState<DemoState>(emptyState);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("Ready");
  const [githubStatus, setGithubStatus] = useState<string>("Not configured");

  async function refresh() {
    const response = await fetch("/api/state", { cache: "no-store" });
    setState((await response.json()) as DemoState);
  }

  useEffect(() => {
    void refresh();
    void (async () => {
      const response = await fetch("/api/github/status", { cache: "no-store" });
      const payload = await response.json();
      if (payload?.run?.conclusion) {
        setGithubStatus(`${payload.run.conclusion.toUpperCase()} · ${payload.run.name}`);
      } else if (payload?.message) {
        setGithubStatus(payload.message);
      } else {
        setGithubStatus("GitHub status unavailable");
      }
    })();
  }, []);

  async function updateConfig(next: Partial<DemoState["config"]>) {
    setSaving(true);
    setStatus("Saving config...");
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: next })
    });
    await refresh();
    setSaving(false);
    setStatus("Config updated");
  }

  async function simulatePush() {
    setSaving(true);
    setStatus("Running pre-ship gate...");
    await fetch("/api/github/push", { method: "POST" });
    await refresh();
    setSaving(false);
    setStatus("Pre-ship gate complete");
  }

  async function simulateTrace() {
    setSaving(true);
    setStatus("Running post-ship trace...");
    await fetch("/api/langsmith/trace", { method: "POST" });
    await refresh();
    setSaving(false);
    setStatus("Trace complete");
  }

  async function resetDemo() {
    setSaving(true);
    setStatus("Resetting demo...");
    const response = await fetch("/api/reset", { method: "POST" });
    if (!response.ok) {
      setStatus(`Reset failed (${response.status})`);
      setSaving(false);
      return;
    }
    await refresh();
    setSaving(false);
    setStatus("Demo reset to baseline");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <h1>{state.config.projectName}</h1>
          <p>Standalone monitoring for pre-ship gates and post-ship trace alerts.</p>
        </div>
        <nav className="nav">
          <Link href="#config">Config</Link>
          <Link href="#events">Events</Link>
          <Link href="#emails">Emails</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h2>Standalone monitoring for any repo, branch, and threshold set.</h2>
          <p>
            This app is separated from the chatbot UI so another team can reuse it as a dedicated gate
            and alert surface. Configure the repo, branch, recipient, thresholds, and deploy target,
            then wire push and trace events into this service.
          </p>
          <div className="button-row">
            <Link className="button" href="#config">Open config</Link>
            <Link className="button secondary" href="#events">View events</Link>
          </div>
          <div className="metric" style={{ marginTop: 12 }}>
            <div className="label">Status</div>
            <div className="value">{status}</div>
          </div>
          <div className="metric" style={{ marginTop: 12 }}>
            <div className="label">GitHub workflow</div>
            <div className="value">{githubStatus}</div>
          </div>
          <div className="kpis">
            <div className="kpi">
              <span>Repo</span>
              <strong>{state.config.repoName}</strong>
            </div>
            <div className="kpi">
              <span>Branch</span>
              <strong>{state.config.branchName}</strong>
            </div>
            <div className="kpi">
              <span>Deploy target</span>
              <strong>Vercel</strong>
            </div>
            <div className="kpi">
              <span>Recipient</span>
              <strong>{state.config.recipientEmail}</strong>
            </div>
          </div>
        </div>

        <div className="hero-side">
          <div className="panel" id="config">
            <div className="section-title">
              <h3>Project config</h3>
              <span className="badge">editable</span>
            </div>
            <div className="stack">
              <div className="field">
                <label>Repository</label>
                <input value={state.config.repoName} onChange={(event) => updateConfig({ repoName: event.target.value })} />
              </div>
              <div className="field">
                <label>Branch</label>
                <input value={state.config.branchName} onChange={(event) => updateConfig({ branchName: event.target.value })} />
              </div>
              <div className="field">
                <label>Recipient email</label>
                <input value={state.config.recipientEmail} onChange={(event) => updateConfig({ recipientEmail: event.target.value })} />
              </div>
              <div className="field">
                <label>Vercel deploy URL</label>
                <input value={state.config.deployUrl} onChange={(event) => updateConfig({ deployUrl: event.target.value })} />
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="section-title">
              <h3>Pipeline actions</h3>
              <span className="badge warn">demo event triggers</span>
            </div>
            <div className="grid-actions">
              <button className="button" onClick={simulatePush} disabled={saving}>
                Simulate GitHub push
              </button>
              <button className="button secondary" onClick={simulateTrace} disabled={saving}>
                Simulate LangSmith trace
              </button>
              <button className="button secondary" onClick={resetDemo} disabled={saving}>
                Reset demo
              </button>
            </div>
            <div className="stack" style={{ marginTop: 16 }}>
              <div className="metric">
                <div className="label">Last push</div>
                <div className="value">
                  {state.pipeline.lastPush
                    ? `${state.pipeline.lastPush.status.toUpperCase()} · ${state.pipeline.lastPush.reason}`
                    : "No push yet"}
                </div>
              </div>
              <div className="metric">
                <div className="label">Deployment</div>
                <div className="value">
                  {state.pipeline.deployment
                    ? `${state.pipeline.deployment.status.toUpperCase()} · ${state.pipeline.deployment.target}`
                    : "No deployment yet"}
                </div>
              </div>
              <div className="metric">
                <div className="label">Trace</div>
                <div className="value">
                  {state.pipeline.trace
                    ? `${state.pipeline.trace.status.toUpperCase()} · ${state.pipeline.trace.reason}`
                    : "No trace yet"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="section-title">
          <h3>Event timeline</h3>
          <span className="badge" id="events">{state.events.length} events</span>
        </div>
        <div className="timeline">
          {state.events.slice().reverse().map((event) => (
            <div className="timeline-item" key={event.id}>
              <strong>{event.title}</strong>
              <div className="muted">{event.detail}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: "0.82rem" }}>
                {new Date(event.at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid-2" style={{ marginTop: 18 }}>
        <div className="panel" id="emails">
          <div className="section-title">
            <h3>Email log</h3>
            <span className="badge">{state.emails.length} sent</span>
          </div>
          <div className="timeline">
            {state.emails.slice().reverse().map((email) => (
              <div className="timeline-item" key={email.id}>
                <strong>{email.kind} alert</strong>
                <div className="muted">{email.subject}</div>
                <div className="muted">{email.to}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="section-title">
            <h3>Threshold summary</h3>
            <span className="badge ok">CI rules</span>
          </div>
          <div className="grid-2">
            {Object.entries(state.config.thresholds).map(([key, value]) => (
              <div className="metric" key={key}>
                <div className="label">{key}</div>
                <div className="value">{Math.round(value * 100)}%</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
