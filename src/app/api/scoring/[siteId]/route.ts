import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;

  try {
    const reports = await db
      .selectFrom("scoring_reports")
      .selectAll()
      .where("site_id", "=", siteId)
      .orderBy("created_at", "desc")
      .limit(10)
      .execute();

    return NextResponse.json(reports);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch reports", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;

  try {
    const body = await request.json();

    const report = await db
      .insertInto("scoring_reports")
      .values({
        site_id: siteId,
        total_pages: body.total_pages ?? 0,
        pages_to_prune: body.pages_to_prune ?? 0,
        pages_to_update: body.pages_to_update ?? 0,
        pages_to_expand: body.pages_to_expand ?? 0,
        pages_to_rewrite_meta: body.pages_to_rewrite_meta ?? 0,
        report_data: body.report_data ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Update site's last_scored_at
    await db
      .updateTable("sites")
      .set({
        last_scored_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", siteId)
      .execute();

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create report", detail: String(error) },
      { status: 500 }
    );
  }
}
