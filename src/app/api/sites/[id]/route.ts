import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const site = await db
      .selectFrom("sites")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    return NextResponse.json(site);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch site", detail: String(error) },
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

    const site = await db
      .updateTable("sites")
      .set({ ...body, updated_at: new Date().toISOString() })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    return NextResponse.json(site);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update site", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await db.deleteFrom("sites").where("id", "=", id).execute();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete site", detail: String(error) },
      { status: 500 }
    );
  }
}
