import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

// GET /api/activity — read events with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agent = searchParams.get("agent");
    const runId = searchParams.get("run_id");
    const since = searchParams.get("since");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

    let query = db
      .selectFrom("activity_log")
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(limit);

    if (agent) {
      // Support comma-separated agent filters
      const agents = agent.split(",").map((a) => a.trim());
      if (agents.length === 1) {
        query = query.where("agent", "=", agents[0]);
      } else {
        query = query.where("agent", "in", agents);
      }
    }

    if (runId) {
      query = query.where("run_id", "=", runId);
    }

    if (since) {
      query = query.where("created_at", ">", new Date(since));
    }

    const events = await query.execute();
    return NextResponse.json(events);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch activity", detail: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/activity — write a single event
const eventSchema = z.object({
  run_id: z.string().min(1),
  agent: z.string().min(1),
  level: z.enum(["info", "warn", "error", "header", "section"]).default("info"),
  message: z.string().min(1),
  meta: z.record(z.unknown()).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = eventSchema.parse(body);

    await db
      .insertInto("activity_log")
      .values({
        run_id: data.run_id,
        agent: data.agent,
        level: data.level,
        message: data.message,
        meta: data.meta ?? null,
      })
      .execute();

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", detail: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to log activity", detail: String(error) },
      { status: 500 }
    );
  }
}
