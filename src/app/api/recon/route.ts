import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const digests = await db
      .selectFrom("recon_digests")
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(10)
      .execute();

    return NextResponse.json(digests);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch digests", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const digest = await db
      .insertInto("recon_digests")
      .values({
        digest_data: body.digest_data ?? null,
        opportunities: body.opportunities ?? null,
        sources_checked: body.sources_checked ?? [],
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return NextResponse.json(digest, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create digest", detail: String(error) },
      { status: 500 }
    );
  }
}
