import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const eventSchema = z.object({
  run_id: z.string().min(1),
  agent: z.string().min(1),
  level: z.enum(["info", "warn", "error", "header", "section"]).default("info"),
  message: z.string().min(1),
  meta: z.record(z.unknown()).nullable().optional(),
});

const batchSchema = z.object({
  events: z.array(eventSchema).min(1).max(100),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { events } = batchSchema.parse(body);

    await db
      .insertInto("activity_log")
      .values(
        events.map((e) => ({
          run_id: e.run_id,
          agent: e.agent,
          level: e.level,
          message: e.message,
          meta: e.meta ?? null,
        }))
      )
      .execute();

    return NextResponse.json({ ok: true, count: events.length }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", detail: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to log activity batch", detail: String(error) },
      { status: 500 }
    );
  }
}
