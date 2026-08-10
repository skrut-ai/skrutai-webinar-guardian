import { NextResponse } from "next/server";
import { evaluatePreShip, metricStatus } from "@/lib/metrics";
import { createEmail, createEvent, getState, updateState } from "@/lib/store";
import { sendDemoEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST() {
  const state = await getState();
  const metrics = evaluatePreShip(state.flags);
  const decision = metricStatus(metrics, state.config.thresholds);
  const sha = `skrutai-${Date.now().toString(16)}`;

  if (decision.passed) {
    const next = await updateState((current) => ({
      ...current,
      pipeline: {
        ...current.pipeline,
        lastPush: {
          sha,
          status: "passed",
          reason: "All quality gates passed.",
          metrics,
          at: new Date().toISOString()
        },
        deployment: {
          status: "deployed",
          target: current.config.deployUrl,
          at: new Date().toISOString()
        }
      },
      events: [
        createEvent("deploy", "GitHub Action passed", `Auto-deployed to ${current.config.deployUrl}.`),
        createEvent("push", "Push received", `Push ${sha} passed the CI gate.`),
        ...current.events
      ]
    }));

    return NextResponse.json({
      ok: true,
      status: "passed",
      sha,
      metrics,
      deployment: next.pipeline.deployment
    });
  }

  const summary = decision.failed.map((item) => `${item.label} ${Math.round(item.value * 100)}% < ${Math.round(item.threshold * 100)}%`).join(", ");
  const subject = `skrutai-webinar-guardian pre-ship gate failed on ${state.config.branchName}`;
  const preview = `Push ${sha} failed the pre-ship gate. ${summary}. Manual review or code change is required.`;
  await sendDemoEmail({
    to: state.config.recipientEmail,
    subject,
    preview,
    kind: "pre-ship"
  });

  const next = await updateState((current) => ({
    ...current,
    pipeline: {
      ...current.pipeline,
      lastPush: {
        sha,
        status: "failed",
        reason: summary,
        metrics,
        at: new Date().toISOString()
      },
      deployment: {
        status: "gated",
        target: current.config.deployUrl,
        at: new Date().toISOString()
      }
    },
    emails: [
      createEmail("pre-ship", current.config.recipientEmail, subject, preview),
      ...current.emails
    ],
    events: [
      createEvent("email", "Gate email sent", subject),
      createEvent("gate", "GitHub Action failed", summary),
      createEvent("push", "Push received", `Push ${sha} was gated before deploy.`),
      ...current.events
    ]
  }));

  return NextResponse.json({
    ok: false,
    status: "failed",
    sha,
    metrics,
    summary,
    deployment: next.pipeline.deployment
  });
}
