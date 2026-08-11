import { NextResponse } from "next/server";
import { createEmail, createEvent, getState, metricStatus, sendDemoEmail, updateState } from "@/lib/core";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    source?: string;
    question?: string;
    answer?: string;
    metrics?: {
      hallucination?: number;
      ragPrecision?: number;
      ragRecall?: number;
      security?: number;
    };
    model?: string;
    project?: string;
  };

  const state = await getState();
  const metrics = {
    hallucination: body.metrics?.hallucination ?? 1,
    ragPrecision: body.metrics?.ragPrecision ?? 1,
    ragRecall: body.metrics?.ragRecall ?? 1,
    security: body.metrics?.security ?? 1
  };

  const decision = metricStatus(metrics, state.config.thresholds);

  if (decision.passed) {
    const next = await updateState((current) => ({
      ...current,
      pipeline: {
        ...current.pipeline,
        trace: {
          status: "healthy",
          metrics,
          reason: "LangSmith trace stayed above threshold.",
          at: new Date().toISOString()
        }
      },
      events: [
        createEvent("trace", "LangSmith trace healthy", body.question ?? "Trace webhook received."),
        ...current.events
      ]
    }));

    return NextResponse.json({
      ok: true,
      status: "healthy",
      metrics,
      trace: next.pipeline.trace
    });
  }

  const summary = decision.failed.map((item) => `${item.label} ${Math.round(item.value * 100)}% < ${Math.round(item.threshold * 100)}%`).join(", ");
  const subject = `skrutai-monitoring LangSmith threshold breached`;
  const preview = `Source: ${body.source ?? "unknown"} | Model: ${body.model ?? "unknown"} | ${summary}`;

  await sendDemoEmail({
    to: state.config.recipientEmail,
    subject,
    preview,
    kind: "post-ship"
  });

  const next = await updateState((current) => ({
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
      createEvent("email", "LangSmith breach email sent", subject),
      createEvent("trace", "LangSmith trace threshold breached", summary),
      ...current.events
    ]
  }));

  return NextResponse.json({
    ok: false,
    status: "breached",
    metrics,
    summary,
    trace: next.pipeline.trace
  });
}
