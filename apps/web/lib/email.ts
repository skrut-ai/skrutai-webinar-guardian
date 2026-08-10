import type { DemoEmail } from "./types";

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
      throw new Error(`Resend request failed: ${detail}`);
    }

    return { delivered: true, transport: "resend" };
  }

  console.log("[skrutai-web] demo email", input.subject, input.preview);
  return { delivered: false, transport: "console" };
}
