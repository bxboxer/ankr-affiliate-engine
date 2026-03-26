import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const run = (body as { run?: string }).run ?? "all";

    // Trigger GitHub Actions workflow dispatch
    const githubToken = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER ?? "bxboxer";
    const repo = "ankr-affiliate-engine";

    if (!githubToken) {
      return NextResponse.json(
        { error: "GITHUB_TOKEN not configured" },
        { status: 500 }
      );
    }

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/orchestrator.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: { run_mode: run },
        }),
      }
    );

    if (res.status === 204) {
      return NextResponse.json({
        success: true,
        message: `Orchestrator triggered with run=${run}`,
      });
    }

    const errorText = await res.text();
    return NextResponse.json(
      { error: "GitHub Actions trigger failed", detail: errorText },
      { status: res.status }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to trigger orchestrator", detail: String(error) },
      { status: 500 }
    );
  }
}
