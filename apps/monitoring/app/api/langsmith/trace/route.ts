import { NextResponse } from "next/server";
import { createEmail, createEvent, evaluatePostShip, getState, metricStatus, sendDemoEmail, updateState } from "@/lib/core";

export const runtime = "nodejs";

export async function POST() {
  const state = await getState();
  const metrics = evaluatePostShip(state.flags);
  const decision = metricStatus(metrics, state.config.thresholds);

  if (decision.passed) {
    await updateState((current) => ({
      ...current,
      pipeline: {
        ...current.pipeline,
        trace: {
          status: "healthy",
          metrics,
          reason: "All LangSmith post-ship metrics are above threshold.",
          at: new Date().toISOString()
        }
      },
      events: [
        createEvent("trace", "Trace evaluated", "Post-ship metrics stayed green."),
        ...current.events
      ]
    }));

    return NextResponse.json({
      ok: true,
      status: "healthy",
      metrics,
      message: "Trace stayed above threshold. No email was triggered."
    });
  }

  const summary = decision.failed.map((item) => `${item.label} ${Math.round(item.value * 100)}% < ${Math.round(item.threshold * 100)}%`).join(", ");
  const subject = `skrutai-monitoring post-ship threshold breached`;
  const preview = `LangSmith trace reported a breach. ${summary}. Alert recipient ${state.config.recipientEmail}.`;

  await sendDemoEmail({
    to: state.config.recipientEmail,
    subject,
    preview,
    kind: "post-ship"
  });

  await updateState((current) => ({
    ...current,
    pipeline: {
      ...current.pipeline,
      trace: {
        status: "breached",
        metrics,
        reason: summary,
        at: new Date().toISOString()
      }
    },
    emails: [
      createEmail("post-ship", current.config.recipientEmail, subject, preview),
      ...current.emails
    ],
    events: [
      createEvent("email", "Breach email sent", subject),
      createEvent("trace", "Trace threshold breached", summary),
      ...current.events
    ]
  }));

  return NextResponse.json({
    ok: false,
    status: "breached",
    metrics,
    summary,
    message: "Threshold breached. Email sent to the configured recipient."
  });
}
