import { NextRequest, NextResponse } from "next/server";
import { triggerOrchestrator } from "@/lib/trigger-orchestrator";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let run = "all";

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      run = (body as { run?: string }).run ?? "all";
    } else {
      const formData = await request.formData().catch(() => null);
      if (formData) {
        run = (formData.get("run") as string) ?? "all";
      }
    }

    const result = await triggerOrchestrator(run);

    if (result.ok) {
      return NextResponse.json({
        success: true,
        message: `Orchestrator triggered with run=${run}`,
      });
    }

    return NextResponse.json(
      { error: "GitHub Actions trigger failed", detail: result.error },
      { status: 500 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to trigger orchestrator", detail: String(error) },
      { status: 500 }
    );
  }
}
