import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const job = await db
      .selectFrom("content_jobs")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!job) {
      return NextResponse.json(
        { error: "Content job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(job);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch content job", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    // Build update object from allowed fields
    const allowed = [
      "status",
      "generated_content",
      "word_count",
      "error_message",
      "commit_sha",
      "published_url",
      "published_at",
      "title",
      "brief",
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Always update updated_at
    updates.updated_at = sql`now()`;

    const result = await db
      .updateTable("content_jobs")
      .set(updates)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!result) {
      return NextResponse.json(
        { error: "Content job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update content job", detail: String(error) },
      { status: 500 }
    );
  }
}
