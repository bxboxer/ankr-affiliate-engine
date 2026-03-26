import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const createSiteSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  niche: z.string().min(1),
  repo_name: z.string().min(1),
  affiliate_program: z.string().default("amazon"),
  affiliate_tag: z.string().nullable().optional(),
  vercel_project_id: z.string().nullable().optional(),
  audience_description: z.string().nullable().optional(),
  target_keywords: z.array(z.string()).nullable().optional(),
  status: z.enum(["active", "spawning", "paused", "archived"]).default("active"),
});

export async function GET() {
  try {
    const sites = await db
      .selectFrom("sites")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();

    return NextResponse.json(sites);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch sites", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createSiteSchema.parse(body);

    const site = await db
      .insertInto("sites")
      .values({
        name: data.name,
        domain: data.domain,
        niche: data.niche,
        repo_name: data.repo_name,
        affiliate_program: data.affiliate_program,
        affiliate_tag: data.affiliate_tag ?? null,
        vercel_project_id: data.vercel_project_id ?? null,
        audience_description: data.audience_description ?? null,
        target_keywords: data.target_keywords ?? null,
        status: data.status,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return NextResponse.json(site, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create site", detail: String(error) },
      { status: 500 }
    );
  }
}
