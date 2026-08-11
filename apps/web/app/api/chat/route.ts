import { NextResponse } from "next/server";
import { getState } from "@/lib/store";
import { generateChatResult, langSmithClient } from "@/lib/chat";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { question?: string };
  const question = body.question?.trim();

  if (!question) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  const state = await getState();
  try {
    const result = await generateChatResult({
      question,
      flags: state.flags
    });

    if (langSmithClient) {
      try {
        await langSmithClient.flush();
      } catch (error) {
        console.warn("[skrutai-web] LangSmith flush failed", error);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown chat failure.";
    return NextResponse.json(
      {
        error: message
      },
      { status: 500 }
    );
  }
}
