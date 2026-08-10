import { NextResponse } from "next/server";
import { createEvent, createInitialState, updateState } from "@skrutai/core";

export const runtime = "nodejs";

export async function POST() {
  const fresh = createInitialState();
  const state = await updateState(() => ({
    ...fresh,
    events: [createEvent("config", "Demo reset", "State returned to the default clean baseline."), ...fresh.events]
  }));

  return NextResponse.json(state);
}
