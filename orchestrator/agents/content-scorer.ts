import { askClaude } from "../lib/claude";
import { log } from "../lib/utils";
import { GSCCollector } from "../lib/collectors/gsc";

interface ScorerConfig {
  anthropicApiKey: string;
  maxBriefsPerRun: number;
  appBaseUrl: string;
}

interface SiteRef {
  id: string;
  name: string;
  domain: string;
}

interface PageScore {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  action: "KEEP" | "UPDATE" | "EXPAND" | "PRUNE" | "REWRITE_META";
  reason: string;
  brief?: string;
}

interface ScoringReport {
  totalPages: number;
  total_pages: number;
  pages_to_prune: number;
  pages_to_update: number;
  pages_to_expand: number;
  pages_to_rewrite_meta: number;
  report_data: {
    scores: PageScore[];
    generatedAt: string;
  };
}

export class ContentScorer {
  private config: ScorerConfig;

  constructor(config: ScorerConfig) {
    this.config = config;
  }

  async scoreSite(site: SiteRef): Promise<ScoringReport> {
    // In production, this pulls from Google Search Console API.
    // For now, we'll use the dashboard API to check for manually uploaded data,
    // or return an empty report that prompts GSC setup.

    log.info(`Scoring ${site.name} (${site.domain})`);

    // TODO: Integrate GSC API here when GSC_SERVICE_ACCOUNT_B64 is configured
    // For now, generate a placeholder report that signals GSC needs setup
    const gscData = await this.fetchGSCData(site.domain);

    if (!gscData || gscData.length === 0) {
      log.warn(
        `No GSC data for ${site.domain} — configure GSC service account`
      );
      return {
        totalPages: 0,
        total_pages: 0,
        pages_to_prune: 0,
        pages_to_update: 0,
        pages_to_expand: 0,
        pages_to_rewrite_meta: 0,
        report_data: {
          scores: [],
          generatedAt: new Date().toISOString(),
        },
      };
    }

    // Score each page
    const scores: PageScore[] = gscData.map((page) =>
      this.scorePage(page)
    );

    // Generate AI briefs for actionable pages
    const actionable = scores.filter((s) => s.action !== "KEEP");
    const toBrief = actionable.slice(0, this.config.maxBriefsPerRun);

    for (const page of toBrief) {
      try {
        page.brief = await this.generateBrief(site, page);
      } catch (err) {
        log.warn(`Brief generation failed for ${page.url}: ${err}`);
      }
    }

    const report: ScoringReport = {
      totalPages: scores.length,
      total_pages: scores.length,
      pages_to_prune: scores.filter((s) => s.action === "PRUNE").length,
      pages_to_update: scores.filter((s) => s.action === "UPDATE").length,
      pages_to_expand: scores.filter((s) => s.action === "EXPAND").length,
      pages_to_rewrite_meta: scores.filter((s) => s.action === "REWRITE_META")
        .length,
      report_data: {
        scores,
        generatedAt: new Date().toISOString(),
      },
    };

    log.info(
      `${site.name}: ${report.total_pages} pages — ` +
        `${report.pages_to_prune} prune, ${report.pages_to_update} update, ` +
        `${report.pages_to_expand} expand, ${report.pages_to_rewrite_meta} rewrite meta`
    );

    return report;
  }

  private scorePage(page: {
    url: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }): PageScore {
    let action: PageScore["action"] = "KEEP";
    let reason = "";

    if (page.impressions > 500 && page.ctr < 0.02) {
      action = "REWRITE_META";
      reason = `High impressions (${page.impressions}) but low CTR (${(page.ctr * 100).toFixed(1)}%) — title/description needs work`;
    } else if (page.position > 20 && page.impressions < 50 && page.clicks < 2) {
      action = "PRUNE";
      reason = `Low position (${page.position.toFixed(1)}), minimal impressions — candidate for removal or consolidation`;
    } else if (
      page.position >= 5 &&
      page.position <= 15 &&
      page.impressions > 200
    ) {
      action = "UPDATE";
      reason = `Ranking position ${page.position.toFixed(1)} with ${page.impressions} impressions — close to page 1, update to push higher`;
    } else if (page.clicks > 10 && page.position < 5) {
      action = "EXPAND";
      reason = `Strong performer at position ${page.position.toFixed(1)} — expand with related content to capture more queries`;
    }

    return { ...page, action, reason };
  }

  private async generateBrief(
    site: SiteRef,
    page: PageScore
  ): Promise<string> {
    const prompt = `Generate a specific action brief for this page:

Site: ${site.name} (${site.domain})
URL: ${page.url}
Action: ${page.action}
Reason: ${page.reason}
Current metrics: ${page.clicks} clicks, ${page.impressions} impressions, ${(page.ctr * 100).toFixed(1)}% CTR, position ${page.position.toFixed(1)}

Write a 2-3 sentence specific brief on exactly what should be changed to improve this page's performance. Be concrete — reference the actual metrics and suggest specific improvements.`;

    return askClaude(prompt, {
      system:
        "You are an SEO content strategist. Give direct, actionable briefs.",
      maxTokens: 500,
    });
  }

  private async fetchGSCData(
    domain: string
  ): Promise<
    Array<{
      url: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }> | null
  > {
    // Try OAuth-based GSC first (preferred)
    if (process.env.GOOGLE_GSC_CLIENT_ID && process.env.GOOGLE_GSC_REFRESH_TOKEN) {
      try {
        const gsc = new GSCCollector();
        const siteUrl = `sc-domain:${domain}`;
        const data = await gsc.getPagePerformance(siteUrl, 28);
        if (data.length > 0) return data;

        // Try with https:// prefix if sc-domain didn't work
        const httpsData = await gsc.getPagePerformance(`https://${domain}/`, 28);
        if (httpsData.length > 0) return httpsData;

        log.warn(`GSC returned no data for ${domain} — site may not be verified`);
        return null;
      } catch (err) {
        log.warn(`GSC OAuth failed for ${domain}: ${err}`);
        return null;
      }
    }

    log.warn("GSC credentials not configured — set GOOGLE_GSC_CLIENT_ID and GOOGLE_GSC_REFRESH_TOKEN");
    return null;
  }
}
