import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import type { DemoEmail, DemoEvent, DemoFlags, DemoState } from "./types";

const storePath = path.join(process.cwd(), ".data", "skrutai-monitoring.json");
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
