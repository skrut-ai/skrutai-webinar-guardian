import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const hasResendApiKey = Boolean(process.env.RESEND_API_KEY);
  const hasResendFromEmail = Boolean(process.env.RESEND_FROM_EMAIL);
  const hasSupabaseUrl = Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSupabaseServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasSupabaseTable = Boolean(process.env.SUPABASE_TABLE);
  const hasMonitoringWebhook = Boolean(process.env.MONITORING_ALERT_WEBHOOK_URL);

  return NextResponse.json({
    ok: true,
    env: {
      resend: {
        apiKey: hasResendApiKey,
        fromEmail: hasResendFromEmail
      },
      supabase: {
        url: hasSupabaseUrl,
        serviceRoleKey: hasSupabaseServiceRoleKey,
        table: hasSupabaseTable
      },
      monitoringWebhook: hasMonitoringWebhook
    }
  });
}
