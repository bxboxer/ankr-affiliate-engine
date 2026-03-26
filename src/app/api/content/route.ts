import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const contentJobSchema = z.object({
  site_id: z.string().uuid(),
  job_type: z.enum(["new_article", "update", "rewrite_meta", "expand"]),
  title: z.string().min(1),
  slug: z.string().min(1),
  target_keywords: z.array(z.string()).nullable().optional(),
  source: z.enum(["research", "scoring", "manual"]),
  source_id: z.string().uuid().nullable().optional(),
  brief: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const siteId = searchParams.get("site_id");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  try {
    let query = db
      .selectFrom("content_jobs")
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(limit);

    if (status) {
      query = query.where(
        "status",
        "=",
        status as "queued" | "generating" | "review" | "published" | "failed"
      );
    }

    if (siteId) {
      query = query.where("site_id", "=", siteId);
    }

    const results = await query.execute();
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch content jobs", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = contentJobSchema.parse(body);

    const result = await db
      .insertInto("content_jobs")
      .values({
        site_id: data.site_id,
        job_type: data.job_type,
        title: data.title,
        slug: data.slug,
        target_keywords: data.target_keywords ?? null,
        source: data.source,
        source_id: data.source_id ?? null,
        brief: data.brief ?? null,
        status: "queued",
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", detail: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create content job", detail: String(error) },
      { status: 500 }
    );
  }
}
