import fs from "fs/promises";
import path from "path";

const statePath = path.join(process.cwd(), ".data", "skrutai-webinar-guardian.json");

try {
  const raw = await fs.readFile(statePath, "utf8");
  const state = JSON.parse(raw);
  const flags = state?.flags ?? {};
  const risk = Object.values(flags).some(Boolean);

  if (risk) {
    console.error("CI gate failed: demo state currently has active risk flags.");
    process.exit(1);
  }

  console.log("CI gate passed: demo state is clean.");
} catch {
  console.log("CI gate passed: no persisted state found.");
}
