import { NextResponse } from "next/server";
import { createEvent, getState, patchFlags, updateState } from "@skrutai/core";

export const runtime = "nodejs";

export async function GET() {
  const state = await getState();
  return NextResponse.json(state);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    config?: Partial<Awaited<ReturnType<typeof getState>>["config"]>;
    flags?: Partial<Awaited<ReturnType<typeof getState>>["flags"]>;
  };

  const next = await updateState((state) => {
    const updated = {
      ...state,
      config: body.config ? { ...state.config, ...body.config, thresholds: body.config.thresholds ? { ...state.config.thresholds, ...body.config.thresholds } : state.config.thresholds } : state.config,
      flags: body.flags ? patchFlags(state.flags, body.flags) : state.flags,
      events: state.events
    };

    if (body.config) {
      updated.events = [createEvent("config", "Configuration updated", "Monitoring config changed from the UI."), ...state.events];
    }

    if (body.flags) {
      updated.events = [createEvent("flags", "Flags updated", "Safety flags changed from the UI."), ...updated.events];
    }

    return updated;
  });

  return NextResponse.json(next);
}
