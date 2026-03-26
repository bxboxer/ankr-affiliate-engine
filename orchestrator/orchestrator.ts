/**
 * ANKR Affiliate Engine — Orchestrator
 *
 * Central brain that coordinates site spawning, content scoring,
 * recon intelligence, and dashboard sync.
 *
 * Usage:
 *   npx tsx orchestrator/orchestrator.ts --run=all
 *   npx tsx orchestrator/orchestrator.ts --run=spawn
 *   npx tsx orchestrator/orchestrator.ts --run=score
 *   npx tsx orchestrator/orchestrator.ts --run=recon
 */

import { config } from "dotenv";
config();

import { SiteSpawner } from "./agents/site-spawner";
import { ContentScorer } from "./agents/content-scorer";
import { ReconAgent } from "./agents/recon-agent";
import { log } from "./lib/utils";

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
  reconSources: [
    "https://detailed.com",
    "https://ahrefs.com/blog",
    "https://www.seroundtable.com",
    "https://www.reddit.com/r/juststart/.rss",
    "https://www.reddit.com/r/SEO/.rss",
  ],
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const runFlag =
    args.find((a) => a.startsWith("--run="))?.split("=")[1] ?? "all";

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
    recon: null as unknown,
    errors: [] as string[],
  };

  try {
    // ── SPAWN ─────────────────────────────────────────────────────────────
    if (runFlag === "all" || runFlag === "spawn") {
      log.section("Spawn Agent");
      const spawner = new SiteSpawner(CONFIG);

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
      const scorer = new ContentScorer(CONFIG);
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

    // ── RECON ─────────────────────────────────────────────────────────────
    if (runFlag === "all" || runFlag === "recon") {
      log.section("Recon Agent");
      const recon = new ReconAgent(CONFIG);
      results.recon = await recon.run();
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
  log.info(`Recon: ${results.recon ? "done" : "skipped"}`);
  if (results.errors.length > 0) {
    log.error(`Errors: ${results.errors.join(", ")}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
