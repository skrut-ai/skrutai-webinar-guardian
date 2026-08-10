import { NextResponse } from "next/server";
import { createEvent, resetState, updateState } from "@/lib/store";

export const runtime = "nodejs";

export async function POST() {
  const fresh = await resetState();
  const state = await updateState((current) => ({
    ...fresh,
    events: [createEvent("config", "Demo reset", "State returned to the default clean baseline."), ...current.events]
  }));

  return NextResponse.json(state);
}
