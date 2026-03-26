"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

export async function generateFromResearch(formData: FormData) {
  const siteId = formData.get("site_id") as string;

  const niches = await db
    .selectFrom("niche_research")
    .selectAll()
    .where("status", "=", "complete")
    .orderBy("consensus_score", "desc")
    .limit(5)
    .execute();

  for (const niche of niches) {
    const existing = await db
      .selectFrom("content_jobs")
      .select("id")
      .where("source", "=", "research")
      .where("source_id", "=", niche.id)
      .where("site_id", "=", siteId)
      .executeTakeFirst();

    if (existing) continue;

    const title = `Best ${niche.niche_name} ${new Date().getFullYear()}: Reviews & Buying Guide`;
    const slug = slugify(`best-${niche.niche_name}-${new Date().getFullYear()}`);
    const keywords = (niche.top_keywords as string[]) ?? [];
    const analysis = niche.claude_analysis as Record<string, unknown> | null;

    const brief = [
      `Niche: ${niche.niche_name} (consensus score: ${niche.consensus_score}/100)`,
      `Category: ${niche.category}`,
      niche.search_volume_avg ? `Search volume: ${niche.search_volume_avg}/mo` : null,
      niche.avg_cpc ? `Avg CPC: $${(niche.avg_cpc / 100).toFixed(2)}` : null,
      niche.competition_level ? `Competition: ${niche.competition_level}` : null,
      keywords.length > 0 ? `Top keywords: ${keywords.slice(0, 5).join(", ")}` : null,
      analysis?.reasoning ? `Analysis: ${analysis.reasoning}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await db
      .insertInto("content_jobs")
      .values({
        site_id: siteId,
        job_type: "new_article",
        title,
        slug,
        target_keywords: keywords.length > 0 ? keywords : null,
        source: "research",
        source_id: niche.id,
        brief,
        status: "queued",
      })
      .execute();
  }

  redirect("/content?status=queued");
}

export async function generateFromScoring(formData: FormData) {
  const siteId = formData.get("site_id") as string;

  const report = await db
    .selectFrom("scoring_reports")
    .selectAll()
    .where("site_id", "=", siteId)
    .orderBy("created_at", "desc")
    .executeTakeFirst();

  if (!report) {
    redirect("/content");
    return;
  }

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

  const actionable = reportData.scores?.filter((s) => s.action !== "KEEP") ?? [];
  const batch = actionable.slice(0, 5);

  for (const score of batch) {
    const urlSlug =
      score.url
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

    await db
      .insertInto("content_jobs")
      .values({
        site_id: siteId,
        job_type: jobType as "update" | "expand" | "rewrite_meta",
        title: `${score.action}: ${score.url}`,
        slug: urlSlug,
        target_keywords: null,
        source: "scoring",
        source_id: report.id,
        brief,
        status: "queued",
      })
      .execute();
  }

  redirect("/content?status=queued");
}
