import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import type { DemoEmail, DemoEvent, DemoFlags, DemoState } from "./types";

const storePath = path.join(process.cwd(), ".data", "skrutai-web.json");

const initialState = (): DemoState => ({
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
      title: "Web demo initialized",
      detail: "Demo state is ready for chatbot, push, and tracing simulations.",
      at: new Date().toISOString()
    }
  ]
});

async function readStore(): Promise<DemoState> {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    return JSON.parse(raw) as DemoState;
  } catch {
    return initialState();
  }
}

async function writeStore(state: DemoState): Promise<void> {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(state, null, 2), "utf8");
}

export async function getState(): Promise<DemoState> {
  return readStore();
}

export async function updateState(updater: (state: DemoState) => DemoState | Promise<DemoState>): Promise<DemoState> {
  const current = await readStore();
  const next = await updater(current);
  await writeStore(next);
  return next;
}

export async function resetState(): Promise<DemoState> {
  const state = initialState();
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
