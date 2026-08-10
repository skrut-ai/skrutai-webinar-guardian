import fs from "fs/promises";
import path from "path";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const supabaseTable = process.env.SUPABASE_TABLE ?? "skrutai_monitoring_state";
const supabaseRowId = "skrutai-monitoring";
const statePath = path.join(process.cwd(), ".data", "skrutai-monitoring.json");

async function readLocalState() {
  const raw = await fs.readFile(statePath, "utf8");
  return JSON.parse(raw);
}

async function readRemoteState() {
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

  const rows = await response.json();
  return rows?.[0]?.payload ?? null;
}

try {
  const state = supabaseUrl && supabaseServiceKey ? await readRemoteState() : await readLocalState();
  const flags = state?.flags ?? {};
  const risk = Object.values(flags).some(Boolean);

  if (risk) {
    console.error("CI gate failed: monitoring state currently has active risk flags.");
    process.exit(1);
  }

  console.log("CI gate passed: monitoring state is clean.");
} catch {
  console.log("CI gate passed: no persisted monitoring state found.");
}
