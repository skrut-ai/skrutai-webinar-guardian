import type { DemoFlags, MetricSnapshot, Thresholds } from "./types";

const BASE: MetricSnapshot = {
  hallucination: 0.96,
  ragPrecision: 0.94,
  ragRecall: 0.93,
  security: 0.97
};

const clamp = (value: number) => Math.max(0, Math.min(1, Number(value.toFixed(2))));

function applyPenalty(base: MetricSnapshot, flags: DemoFlags): MetricSnapshot {
  const hallucination = flags.hallucination ? 0.41 : base.hallucination;
  const ragPrecision = flags.ragPoisoning ? 0.53 : base.ragPrecision;
  const ragRecall = flags.retrievalDrift ? 0.58 : base.ragRecall;
  const security = flags.vulnerability ? 0.39 : base.security;

  return {
    hallucination: clamp(hallucination),
    ragPrecision: clamp(ragPrecision),
    ragRecall: clamp(ragRecall),
    security: clamp(security)
  };
}

export function evaluatePreShip(flags: DemoFlags): MetricSnapshot {
  return applyPenalty(BASE, flags);
}

export function evaluatePostShip(flags: DemoFlags): MetricSnapshot {
  return applyPenalty(BASE, flags);
}

export function metricStatus(metrics: MetricSnapshot, thresholds: Thresholds) {
  const details = [
    { key: "hallucination" as const, label: "Hallucination", value: metrics.hallucination, threshold: thresholds.hallucination },
    { key: "ragPrecision" as const, label: "RAG Precision", value: metrics.ragPrecision, threshold: thresholds.ragPrecision },
    { key: "ragRecall" as const, label: "RAG Recall", value: metrics.ragRecall, threshold: thresholds.ragRecall },
    { key: "security" as const, label: "Security", value: metrics.security, threshold: thresholds.security }
  ];

  const failed = details.filter((item) => item.value < item.threshold);

  return {
    details,
    failed,
    passed: failed.length === 0
  };
}
