export type MetricName = "hallucination" | "ragPrecision" | "ragRecall" | "security";

export type Thresholds = Record<MetricName, number>;

export type DemoFlags = {
  hallucination: boolean;
  ragPoisoning: boolean;
  vulnerability: boolean;
  retrievalDrift: boolean;
};

export type DemoConfig = {
  projectName: string;
  repoName: string;
  branchName: string;
  recipientEmail: string;
  deployUrl: string;
  thresholds: Thresholds;
};

export type MetricSnapshot = {
  hallucination: number;
  ragPrecision: number;
  ragRecall: number;
  security: number;
};

export type PipelineState = {
  lastPush: {
    sha: string;
    status: "passed" | "failed";
    reason: string;
    metrics: MetricSnapshot;
    at: string;
  } | null;
  deployment: {
    status: "deployed" | "gated";
    target: string;
    at: string;
  } | null;
  trace: {
    status: "healthy" | "breached";
    metrics: MetricSnapshot;
    at: string;
    reason: string;
  } | null;
};

export type DemoEmail = {
  id: string;
  kind: "pre-ship" | "post-ship";
  to: string;
  subject: string;
  preview: string;
  at: string;
};

export type DemoEvent = {
  id: string;
  type: "push" | "deploy" | "gate" | "trace" | "email" | "config" | "flags";
  title: string;
  detail: string;
  at: string;
};

export type DemoState = {
  config: DemoConfig;
  flags: DemoFlags;
  pipeline: PipelineState;
  emails: DemoEmail[];
  events: DemoEvent[];
};
