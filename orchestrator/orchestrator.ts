/**
 * ANKR Affiliate Engine — Orchestrator
 *
 * Central brain that coordinates site spawning, content scoring,
 * niche research, recon intelligence, and dashboard sync.
 *
 * Usage:
 *   npx tsx orchestrator/orchestrator.ts --run=all
 *   npx tsx orchestrator/orchestrator.ts --run=spawn
 *   npx tsx orchestrator/orchestrator.ts --run=score
 *   npx tsx orchestrator/orchestrator.ts --run=research
 *   npx tsx orchestrator/orchestrator.ts --run=recon
 *   npx tsx orchestrator/orchestrator.ts --run=write
 *   npx tsx orchestrator/orchestrator.ts --run=pipeline
 */

import { config } from "dotenv";
config();

import { SiteSpawner } from "./agents/site-spawner";
import { ContentScorer } from "./agents/content-scorer";
import { NicheResearchAgent } from "./agents/niche-research";
import { ReconAgent } from "./agents/recon-agent";
import { ContentWriter } from "./agents/content-writer";
import { Publisher } from "./lib/publisher";
import { RemoteLogger } from "./lib/remote-logger";

// ── Config ────────────────────────────────────────────────────────────────────

const CONFIG = {
  githubOwner: process.env.GITHUB_OWNER ?? "bxboxer",
  githubToken: process.env.GITHUB_TOKEN!,
  vercelToken: process.env.VERCEL_TOKEN!,
  vercelTeamId: process.env.VERCEL_TEAM_ID,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  templateRepo: process.env.TEMPLATE_REPO ?? "ankr-affiliate-template",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  scoringBatchSize: 5,
  maxBriefsPerRun: 15,
  maxJobsPerRun: 5,
  reconSources: [
    "https://detailed.com",
    "https://ahrefs.com/blog",
    "https://www.seroundtable.com",
    "https://www.reddit.com/r/juststart/.rss",
    "https://www.reddit.com/r/SEO/.rss",
  ],
  seedNiches: [
    "gaming peripherals",
    "home office equipment",
    "smart home devices",
    "fitness equipment",
    "outdoor gear",
    "pet supplies",
    "kitchen gadgets",
    "baby products",
  ],
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const runFlag =
    args.find((a) => a.startsWith("--run="))?.split("=")[1] ?? "all";

  const runId = `${runFlag}-${new Date().toISOString()}`;
  const log = new RemoteLogger({
    appBaseUrl: CONFIG.appBaseUrl,
    runId,
    agent: "orchestrator",
  });

  log.header(`Orchestrator — ${runFlag.toUpperCase()}`);
  log.info(`Time: ${new Date().toISOString()}`);

  // Fetch sites from the dashboard API
  let sites: Array<{
    id: string;
    name: string;
    domain: string;
    niche: string;
    repo_name: string;
    status: string;
  }> = [];

  try {
    const res = await fetch(`${CONFIG.appBaseUrl}/api/sites`);
    if (res.ok) {
      sites = await res.json();
      log.info(`Loaded ${sites.length} sites from API`);
    }
  } catch {
    log.warn("Could not reach dashboard API — running with empty registry");
  }

  const results = {
    spawned: [] as Array<{ name: string; success: boolean; error?: string }>,
    scored: [] as Array<{ siteId: string; siteName: string; totalPages: number }>,
    written: [] as Array<{ jobId: string; success: boolean; wordCount: number }>,
    published: [] as Array<{ jobId: string; success: boolean; url?: string }>,
    research: null as unknown,
    recon: null as unknown,
    errors: [] as string[],
  };

  try {
    // ── SPAWN ─────────────────────────────────────────────────────────────
    if (runFlag === "all" || runFlag === "spawn") {
      log.section("Spawn Agent");
      const spawner = new SiteSpawner({ ...CONFIG, logger: log.child("spawn") });

      // Fetch queued items from API
      let queue: Array<{
        id: string;
        name: string;
        domain: string;
        niche: string;
        audience_description?: string;
        affiliate_program: string;
        affiliate_tag?: string;
        target_keywords?: string[];
      }> = [];

      try {
        const res = await fetch(`${CONFIG.appBaseUrl}/api/spawn`);
        if (res.ok) {
          const all = await res.json();
          queue = all.filter(
            (item: { status: string }) => item.status === "queued"
          );
        }
      } catch {
        log.warn("Could not fetch spawn queue");
      }

      if (queue.length > 0) {
        for (const item of queue) {
          log.info(`Spawning: ${item.name} (${item.domain})`);
          const result = await spawner.spawn(item);
          results.spawned.push(result);
        }
      } else {
        log.info("No sites in spawn queue");
      }
    }

    // ── SCORE ─────────────────────────────────────────────────────────────
    if (runFlag === "all" || runFlag === "score") {
      log.section("Content Scorer");
      const scorer = new ContentScorer({ ...CONFIG, logger: log.child("score") });
      const activeSites = sites.filter((s) => s.status === "active");
      const batch = activeSites.slice(0, CONFIG.scoringBatchSize);

      for (const site of batch) {
        log.info(`Scoring: ${site.name}`);
        const report = await scorer.scoreSite(site);
        results.scored.push({
          siteId: site.id,
          siteName: site.name,
          totalPages: report.totalPages,
        });

        // Push report to dashboard API
        try {
          await fetch(
            `${CONFIG.appBaseUrl}/api/scoring/${site.id}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(report),
            }
          );
        } catch {
          log.warn(`Failed to push report for ${site.name}`);
        }
      }
    }

    // ── RESEARCH ──────────────────────────────────────────────────────────
    if (runFlag === "all" || runFlag === "research") {
      log.section("Niche Research Agent");
      const researcher = new NicheResearchAgent({ ...CONFIG, logger: log.child("research") });
      const opportunities = await researcher.run();
      results.research = opportunities;
    }

    // ── RECON ─────────────────────────────────────────────────────────────
    if (runFlag === "all" || runFlag === "recon") {
      log.section("Recon Agent");
      const recon = new ReconAgent({ ...CONFIG, logger: log.child("recon") });
      results.recon = await recon.run();
    }

    // ── WRITE ──────────────────────────────────────────────────────────────
    if (runFlag === "all" || runFlag === "write" || runFlag === "pipeline") {
      log.section("Content Writer");
      const writer = new ContentWriter({ ...CONFIG, logger: log.child("write") });

      // Fetch queued content jobs from API
      let jobs: Array<{
        id: string;
        site_id: string;
        job_type: "new_article" | "update" | "rewrite_meta" | "expand";
        title: string;
        slug: string;
        target_keywords: string[] | null;
        source: "research" | "scoring" | "manual";
        brief: string | null;
      }> = [];

      try {
        const res = await fetch(
          `${CONFIG.appBaseUrl}/api/content?status=queued`
        );
        if (res.ok) {
          jobs = await res.json();
        }
      } catch {
        log.warn("Could not fetch content jobs");
      }

      if (jobs.length > 0) {
        // Need full site data with affiliate info
        let fullSites: Array<{
          id: string;
          name: string;
          domain: string;
          niche: string;
          repo_name: string;
          affiliate_tag: string | null;
          affiliate_program: string;
          audience_description: string | null;
          status: string;
        }> = [];

        try {
          const res = await fetch(`${CONFIG.appBaseUrl}/api/sites`);
          if (res.ok) fullSites = await res.json();
        } catch {
          // Use existing sites array as fallback
        }

        const siteRefs = (fullSites.length > 0 ? fullSites : sites).map(
          (s) => ({
            ...s,
            affiliate_tag: (s as Record<string, unknown>).affiliate_tag as string | null ?? null,
            affiliate_program: (s as Record<string, unknown>).affiliate_program as string ?? "amazon",
            audience_description: (s as Record<string, unknown>).audience_description as string | null ?? null,
          })
        );

        const genResults = await writer.run(jobs, siteRefs);
        for (const r of genResults) {
          results.written.push({
            jobId: r.jobId,
            success: r.success,
            wordCount: r.wordCount,
          });
        }

        // Auto-publish successfully generated articles
        const publisher = new Publisher({ ...CONFIG, logger: log.child("publish") });
        const toPublish = genResults.filter((r) => r.success);

        for (const gen of toPublish) {
          const job = jobs.find((j) => j.id === gen.jobId);
          const site = siteRefs.find((s) => s.id === job?.site_id);
          if (!job || !site) continue;

          log.info(`Publishing: "${job.title}" to ${site.repo_name}`);
          const pubResult = await publisher.publishArticle(
            site.repo_name,
            site.domain,
            job.slug,
            job.title,
            gen.content
          );
          await publisher.updateJobAfterPublish(gen.jobId, pubResult);
          results.published.push({
            jobId: gen.jobId,
            success: pubResult.success,
            url: pubResult.publishedUrl,
          });
        }
      } else {
        log.info("No content jobs in queue");
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.errors.push(msg);
    log.error(`Fatal: ${msg}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────
  log.header("Complete");
  log.info(`Spawned: ${results.spawned.filter((r) => r.success).length}`);
  log.info(`Scored: ${results.scored.length}`);
  log.info(`Written: ${results.written.filter((r) => r.success).length} (${results.written.reduce((sum, r) => sum + r.wordCount, 0)} words)`);
  log.info(`Published: ${results.published.filter((r) => r.success).length}`);
  log.info(`Research: ${results.research ? "done" : "skipped"}`);
  log.info(`Recon: ${results.recon ? "done" : "skipped"}`);
  if (results.errors.length > 0) {
    log.error(`Errors: ${results.errors.join(", ")}`);
  }

  await log.shutdown();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
