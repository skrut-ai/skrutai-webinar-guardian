import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import os from "os";

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

const storeRoot = process.env.MONITORING_STORE_DIR ?? (process.env.VERCEL ? os.tmpdir() : process.cwd());
const storePath = path.join(storeRoot, ".data", "skrutai-monitoring.json");
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const supabaseTable = process.env.SUPABASE_TABLE ?? "skrutai_monitoring_state";
const supabaseRowId = "skrutai-monitoring";

export const createInitialState = (): DemoState => ({
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
  flags: {
    hallucination: false,
    ragPoisoning: false,
    vulnerability: false,
    retrievalDrift: false
  },
  pipeline: {
    lastPush: null,
    deployment: null,
    trace: null
  },
  emails: [],
  events: [
    {
      id: randomUUID(),
      type: "config",
      title: "Monitoring project initialized",
      detail: "Standalone monitoring state is ready for push, deployment, and tracing simulations.",
      at: new Date().toISOString()
    }
  ]
});

async function readStore(): Promise<DemoState> {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    return JSON.parse(raw) as DemoState;
  } catch {
    return createInitialState();
  }
}

async function writeStore(state: DemoState): Promise<void> {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(state, null, 2), "utf8");
}

function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseServiceKey);
}

async function readStoreFromSupabase(): Promise<DemoState | null> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/${supabaseTable}?select=payload&id=eq.${encodeURIComponent(supabaseRowId)}&limit=1`,
    {
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Supabase read failed: ${response.status} ${await response.text()}`);
  }

  const rows = (await response.json()) as Array<{ payload?: DemoState }>;
  return rows[0]?.payload ?? null;
}

async function writeStoreToSupabase(state: DemoState): Promise<void> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${supabaseTable}?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify([
      {
        id: supabaseRowId,
        payload: state,
        updated_at: new Date().toISOString()
      }
    ])
  });

  if (!response.ok) {
    throw new Error(`Supabase write failed: ${response.status} ${await response.text()}`);
  }
}

export async function getState(): Promise<DemoState> {
  if (hasSupabaseConfig()) {
    try {
      const remote = await readStoreFromSupabase();
      if (remote) {
        return remote;
      }
    } catch (error) {
      console.warn("[skrutai-monitoring] falling back to local store after remote read error", error);
    }
  }

  return readStore();
}

export async function updateState(updater: (state: DemoState) => DemoState | Promise<DemoState>): Promise<DemoState> {
  const current = await getState();
  const next = await updater(current);
  if (hasSupabaseConfig()) {
    try {
      await writeStoreToSupabase(next);
      await writeStore(next);
      return next;
    } catch (error) {
      console.warn("[skrutai-monitoring] falling back to local store after remote write error", error);
    }
  }

  await writeStore(next);
  return next;
}

export async function resetState(): Promise<DemoState> {
  const state = createInitialState();
  if (hasSupabaseConfig()) {
    try {
      await writeStoreToSupabase(state);
      await writeStore(state);
      return state;
    } catch (error) {
      console.warn("[skrutai-monitoring] falling back to local store after reset write error", error);
    }
  }

  await writeStore(state);
  return state;
}

export function createEvent(type: DemoEvent["type"], title: string, detail: string): DemoEvent {
  return {
    id: randomUUID(),
    type,
    title,
    detail,
    at: new Date().toISOString()
  };
}

export function createEmail(kind: DemoEmail["kind"], to: string, subject: string, preview: string): DemoEmail {
  return {
    id: randomUUID(),
    kind,
    to,
    subject,
    preview,
    at: new Date().toISOString()
  };
}

export function patchFlags(current: DemoFlags, patch: Partial<DemoFlags>): DemoFlags {
  return { ...current, ...patch };
}

type EmailInput = {
  to: string;
  subject: string;
  preview: string;
  kind: DemoEmail["kind"];
};

export async function sendDemoEmail(input: EmailInput): Promise<{ delivered: boolean; transport: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (apiKey && from) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          text: input.preview
        })
      });

      if (!response.ok) {
        const detail = await response.text();
        console.warn(`[skrutai-monitoring] Resend failed: ${detail}`);
      } else {
        console.log(`[skrutai-monitoring] Resend email sent to ${input.to}: ${input.subject}`);
        return { delivered: true, transport: "resend" };
      }
    } catch (error) {
      console.warn("[skrutai-monitoring] Resend request threw, falling back to console", error);
    }
  }

  console.log(`[skrutai-monitoring] demo email fallback for ${input.to}: ${input.subject}`);
  console.log("[skrutai-monitoring] demo email preview", input.preview);
  return { delivered: false, transport: "console" };
}
