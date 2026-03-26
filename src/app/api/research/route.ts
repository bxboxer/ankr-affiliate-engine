import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const researchSchema = z.object({
  niche_name: z.string().min(1),
  category: z.string().min(1),
  consensus_score: z.number().int().min(0).max(100),
  search_volume_avg: z.number().nullable().optional(),
  avg_cpc: z.number().nullable().optional(),
  competition_level: z.string().nullable().optional(),
  trending_score: z.number().nullable().optional(),
  reddit_buzz_score: z.number().nullable().optional(),
  amazon_demand_score: z.number().nullable().optional(),
  keyword_data: z.unknown().optional(),
  amazon_data: z.unknown().optional(),
  reddit_data: z.unknown().optional(),
  trend_data: z.unknown().optional(),
  claude_analysis: z.unknown().optional(),
  top_keywords: z.array(z.string()).optional(),
  top_products: z.unknown().optional(),
  sources_used: z.array(z.string()).optional(),
  site_id: z.string().uuid().nullable().optional(),
  status: z.enum(["pending", "complete", "stale"]).default("complete"),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  try {
    let query = db
      .selectFrom("niche_research")
      .selectAll()
      .orderBy("consensus_score", "desc")
      .limit(limit);

    if (category) {
      query = query.where("category", "=", category);
    }

    const results = await query.execute();
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch research", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = researchSchema.parse(body);

    const result = await db
      .insertInto("niche_research")
      .values({
        niche_name: data.niche_name,
        category: data.category,
        consensus_score: data.consensus_score,
        search_volume_avg: data.search_volume_avg ?? null,
        avg_cpc: data.avg_cpc ?? null,
        competition_level: data.competition_level ?? null,
        trending_score: data.trending_score ?? null,
        reddit_buzz_score: data.reddit_buzz_score ?? null,
        amazon_demand_score: data.amazon_demand_score ?? null,
        keyword_data: data.keyword_data ?? null,
        amazon_data: data.amazon_data ?? null,
        reddit_data: data.reddit_data ?? null,
        trend_data: data.trend_data ?? null,
        claude_analysis: data.claude_analysis ?? null,
        top_keywords: data.top_keywords ?? [],
        top_products: data.top_products ?? null,
        sources_used: data.sources_used ?? [],
        site_id: data.site_id ?? null,
        status: data.status,
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
      { error: "Failed to create research entry", detail: String(error) },
      { status: 500 }
    );
  }
}
