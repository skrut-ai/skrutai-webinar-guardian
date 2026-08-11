import OpenAI from "openai";
import { Client as LangSmithClient } from "langsmith";
import { traceable } from "langsmith/traceable";
import { wrapOpenAI } from "langsmith/wrappers";
import type { DemoFlags, MetricSnapshot } from "@/lib/types";

export type ChatContext = {
  question: string;
  flags: DemoFlags;
};

export type ChatResult = {
  answer: string;
  model: string;
  safety: "green" | "degraded";
  metrics: MetricSnapshot;
};

const thresholdMetrics: MetricSnapshot = {
  hallucination: 0.8,
  ragPrecision: 0.75,
  ragRecall: 0.75,
  security: 0.9
};

const langSmithProject = process.env.LANGSMITH_PROJECT ?? "skrutai-web";
const langSmithApiKey = process.env.LANGSMITH_API_KEY;
const langSmithEndpoint = process.env.LANGSMITH_ENDPOINT ?? "https://api.smith.langchain.com";

export const langSmithClient = langSmithApiKey
  ? new LangSmithClient({
      apiKey: langSmithApiKey,
      apiUrl: langSmithEndpoint
    })
  : undefined;

function scoreFromAnswer(answer: string, flags: DemoFlags): MetricSnapshot {
  const lowered = answer.toLowerCase();
  const hallucination = flags.hallucination || /maybe|probably|i think|likely/.test(lowered) ? 0.42 : 0.96;
  const ragPrecision = flags.ragPoisoning || /uncertain|possibly incorrect|fabricated/.test(lowered) ? 0.54 : 0.94;
  const ragRecall = flags.retrievalDrift || /don't know|missing context|cannot verify/.test(lowered) ? 0.58 : 0.93;
  const security = flags.vulnerability || /secret|token|password/.test(lowered) ? 0.39 : 0.97;

  return { hallucination, ragPrecision, ragRecall, security };
}

function renderPrompt(context: ChatContext) {
  const { question, flags } = context;
  const notes: string[] = [];

  if (flags.hallucination) {
    notes.push("Be slightly less grounded and include one tentative statement.");
  }

  if (flags.ragPoisoning) {
    notes.push("Blend in one questionable reference and lower precision.");
  }

  if (flags.retrievalDrift) {
    notes.push("Sound less certain and omit one detail that would otherwise be grounded.");
  }

  if (flags.vulnerability) {
    notes.push("Never reveal secrets, but mention that the security posture is degraded.");
  }

  return [
    "You are the skrutai bootcamp chatbot.",
    "Answer the user directly and keep the answer practical.",
    "If the question is about safety or deployment, explain the pre-ship GitHub gate and post-ship LangSmith tracing.",
    notes.length ? `Injected demo mode notes: ${notes.join(" ")}` : "Injected demo mode notes: safety flags are off.",
    `User question: ${question}`
  ].join(" ");
}

export const generateChatResult = traceable(
  async (context: ChatContext): Promise<ChatResult> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set.");
    }

    const model = process.env.OPENAI_MODEL ?? "gpt-5";
    const client = wrapOpenAI(
      new OpenAI({
        apiKey
      }) as any,
      langSmithClient
        ? {
            client: langSmithClient,
            project_name: langSmithProject,
            tracingEnabled: true
          }
        : {
            project_name: langSmithProject,
            tracingEnabled: true
          }
    );

    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: renderPrompt(context)
            }
          ]
        }
      ]
    });

    const answer = response.output_text ?? "";
    const metrics = scoreFromAnswer(answer, context.flags);
    const safety = metrics.hallucination < thresholdMetrics.hallucination || metrics.security < thresholdMetrics.security ? "degraded" : "green";

    if (safety === "degraded" && process.env.LANGSMITH_ALERT_WEBHOOK_URL) {
      try {
        await fetch(process.env.LANGSMITH_ALERT_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            source: "skrutai-web",
            question: context.question,
            answer,
            metrics,
            model,
            project: process.env.LANGSMITH_PROJECT ?? "skrutai-web"
          })
        });
      } catch {
        console.warn("[skrutai-web] low-score alert webhook failed");
      }
    }

    return {
      answer,
      model,
      safety,
      metrics
    };
  },
  {
    name: "skrutai_web_chat",
    run_type: "llm",
    client: langSmithClient,
    project_name: langSmithProject,
    tracingEnabled: true
  }
);

export function thresholdForChat() {
  return thresholdMetrics;
}
