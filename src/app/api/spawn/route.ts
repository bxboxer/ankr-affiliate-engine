import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const spawnSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  niche: z.string().min(1),
  audience_description: z.string().nullable().optional(),
  affiliate_program: z.string().default("amazon"),
  affiliate_tag: z.string().nullable().optional(),
  target_keywords: z.array(z.string()).optional(),
});

export async function GET() {
  try {
    const queue = await db
      .selectFrom("spawn_queue")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();

    return NextResponse.json(queue);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch queue", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = spawnSchema.parse(body);

    const item = await db
      .insertInto("spawn_queue")
      .values({
        name: data.name,
        domain: data.domain,
        niche: data.niche,
        audience_description: data.audience_description ?? null,
        affiliate_program: data.affiliate_program,
        affiliate_tag: data.affiliate_tag ?? null,
        target_keywords: data.target_keywords ?? null,
        status: "queued",
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to queue spawn", detail: String(error) },
      { status: 500 }
    );
  }
}
