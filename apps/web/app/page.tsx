import Link from "next/link";
import { monitoringAppUrl } from "@/lib/demo";
import { getState } from "@/lib/store";

function formatMetric(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default async function HomePage() {
  const state = await getState();

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <h1>{state.config.projectName}</h1>
          <p>Bootcamp demo for pre-ship gates, deployment routing, and post-ship alerts.</p>
        </div>
        <nav className="nav">
          <Link href="/chatbot">Chatbot</Link>
          <Link href="/tracing">Tracing</Link>
          <a href={monitoringAppUrl}>Monitoring app</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h2>Show the full safety loop, not just a product pitch.</h2>
          <p>
            This web app demos a chatbot with controllable failure flags and a post-ship tracing
            event path. The monitoring service is separate, so another repo can reuse it as a
            standalone gate and alert surface.
          </p>
          <div className="button-row">
            <Link className="button" href="/chatbot">Open chatbot demo</Link>
            <Link className="button secondary" href="/tracing">Open tracing demo</Link>
            <a className="button secondary" href={monitoringAppUrl}>Open monitoring app</a>
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
              <span>Monitoring</span>
              <strong>Standalone app</strong>
            </div>
            <div className="kpi">
              <span>Recipient</span>
              <strong>{state.config.recipientEmail}</strong>
            </div>
          </div>
        </div>

        <div className="hero-side">
          <div className="panel">
            <div className="section-title">
              <h3>Demo path</h3>
              <span className="badge ok">web app</span>
            </div>
            <div className="stack">
              <div className="callout">1. Chatbot flags can force quality degradation.</div>
              <div className="callout">2. Pushes are gated by the monitoring app before deploy.</div>
              <div className="callout">3. Post-ship traces trigger email when metrics fall below threshold.</div>
            </div>
          </div>

          <div className="panel">
            <div className="section-title">
              <h3>Thresholds</h3>
              <span className="badge">current</span>
            </div>
            <div className="grid-2">
              {Object.entries(state.config.thresholds).map(([name, value]) => (
                <div className="metric" key={name}>
                  <div className="label">{name}</div>
                  <div className="value">{formatMetric(value)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
