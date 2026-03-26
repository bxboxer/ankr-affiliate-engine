import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const generateSchema = z.object({
  source: z.enum(["research", "scoring", "manual"]),
  site_id: z.string().uuid(),
  // For manual source
  title: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  brief: z.string().optional(),
  // For scoring source
  scoring_report_id: z.string().uuid().optional(),
  // Limit how many jobs to create
  limit: z.number().int().min(1).max(20).default(5),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = generateSchema.parse(body);
    const created: unknown[] = [];

    if (data.source === "research") {
      // Pull top niche research entries that don't already have content jobs
      const niches = await db
        .selectFrom("niche_research")
        .selectAll()
        .where("status", "=", "complete")
        .orderBy("consensus_score", "desc")
        .limit(data.limit)
        .execute();

      for (const niche of niches) {
        // Check if a job already exists for this niche + site
        const existing = await db
          .selectFrom("content_jobs")
          .select("id")
          .where("source", "=", "research")
          .where("source_id", "=", niche.id)
          .where("site_id", "=", data.site_id)
          .executeTakeFirst();

        if (existing) continue;

        const title = `Best ${niche.niche_name} ${new Date().getFullYear()}: Reviews & Buying Guide`;
        const slug = slugify(
          `best-${niche.niche_name}-${new Date().getFullYear()}`
        );
        const keywords = niche.top_keywords ?? [];
        const analysis = niche.claude_analysis as Record<string, unknown> | null;

        const brief = [
          `Niche: ${niche.niche_name} (consensus score: ${niche.consensus_score}/100)`,
          `Category: ${niche.category}`,
          niche.search_volume_avg
            ? `Search volume: ${niche.search_volume_avg}/mo`
            : null,
          niche.avg_cpc
            ? `Avg CPC: $${(niche.avg_cpc / 100).toFixed(2)}`
            : null,
          niche.competition_level
            ? `Competition: ${niche.competition_level}`
            : null,
          keywords.length > 0
            ? `Top keywords: ${keywords.slice(0, 5).join(", ")}`
            : null,
          analysis?.reasoning
            ? `Analysis: ${analysis.reasoning}`
            : null,
          niche.top_products
            ? `Top products: ${JSON.stringify(niche.top_products)}`
            : null,
        ]
          .filter(Boolean)
          .join("\n");

        const result = await db
          .insertInto("content_jobs")
          .values({
            site_id: data.site_id,
            job_type: "new_article",
            title,
            slug,
            target_keywords: keywords.length > 0 ? keywords : null,
            source: "research",
            source_id: niche.id,
            brief,
            status: "queued",
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        created.push(result);
      }
    } else if (data.source === "scoring") {
      if (!data.scoring_report_id) {
        // Get latest scoring report for this site
        const report = await db
          .selectFrom("scoring_reports")
          .selectAll()
          .where("site_id", "=", data.site_id)
          .orderBy("created_at", "desc")
          .executeTakeFirst();

        if (!report) {
          return NextResponse.json(
            { error: "No scoring reports found for this site" },
            { status: 404 }
          );
        }

        data.scoring_report_id = report.id;
      }

      const report = await db
        .selectFrom("scoring_reports")
        .selectAll()
        .where("id", "=", data.scoring_report_id)
        .executeTakeFirstOrThrow();

      const reportData = report.report_data as {
        scores?: Array<{
          url: string;
          action: string;
          reason: string;
          brief?: string;
          clicks: number;
          impressions: number;
          ctr: number;
          position: number;
        }>;
      };

      const actionable =
        reportData.scores?.filter((s) => s.action !== "KEEP") ?? [];
      const batch = actionable.slice(0, data.limit);

      for (const score of batch) {
        const urlSlug = score.url
          .replace(/^https?:\/\/[^/]+/, "")
          .replace(/^\/|\/$/g, "")
          .replace(/\//g, "-") || "homepage";

        const jobType =
          score.action === "REWRITE_META"
            ? "rewrite_meta"
            : score.action === "EXPAND"
              ? "expand"
              : "update";

        const existing = await db
          .selectFrom("content_jobs")
          .select("id")
          .where("source", "=", "scoring")
          .where("source_id", "=", report.id)
          .where("slug", "=", urlSlug)
          .executeTakeFirst();

        if (existing) continue;

        const brief = [
          `Action: ${score.action}`,
          `Reason: ${score.reason}`,
          score.brief ? `AI Brief: ${score.brief}` : null,
          `Metrics: ${score.clicks} clicks, ${score.impressions} impressions, ${(score.ctr * 100).toFixed(1)}% CTR, position ${score.position.toFixed(1)}`,
        ]
          .filter(Boolean)
          .join("\n");

        const result = await db
          .insertInto("content_jobs")
          .values({
            site_id: data.site_id,
            job_type: jobType as "update" | "expand" | "rewrite_meta",
            title: `${score.action}: ${score.url}`,
            slug: urlSlug,
            target_keywords: null,
            source: "scoring",
            source_id: report.id,
            brief,
            status: "queued",
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        created.push(result);
      }
    } else if (data.source === "manual") {
      if (!data.title) {
        return NextResponse.json(
          { error: "Title is required for manual content" },
          { status: 400 }
        );
      }

      const slug = slugify(data.title);

      const result = await db
        .insertInto("content_jobs")
        .values({
          site_id: data.site_id,
          job_type: "new_article",
          title: data.title,
          slug,
          target_keywords: data.keywords ?? null,
          source: "manual",
          brief: data.brief ?? null,
          status: "queued",
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      created.push(result);
    }

    return NextResponse.json(
      { created: created.length, jobs: created },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", detail: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate content jobs", detail: String(error) },
      { status: 500 }
    );
  }
}
