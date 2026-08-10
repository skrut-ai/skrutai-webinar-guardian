import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  const workflowFile = process.env.GITHUB_WORKFLOW_FILE ?? "skrutai-web-gate-deploy.yml";
  const branch = process.env.GITHUB_BRANCH ?? "main";

  if (!owner || !repo || !token) {
    return NextResponse.json(
      {
        configured: false,
        message: "GitHub status is not configured yet."
      },
      { status: 200 }
    );
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs?branch=${encodeURIComponent(branch)}&per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );

  if (!response.ok) {
    return NextResponse.json(
      {
        configured: true,
        error: `GitHub API error ${response.status}`
      },
      { status: 502 }
    );
  }

  const data = (await response.json()) as {
    workflow_runs?: Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      html_url: string;
      created_at: string;
      updated_at: string;
    }>;
  };

  const run = data.workflow_runs?.[0] ?? null;

  return NextResponse.json({
    configured: true,
    run
  });
}
