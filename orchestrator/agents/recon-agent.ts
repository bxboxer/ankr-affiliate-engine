import { askClaude } from "../lib/claude";
import { log } from "../lib/utils";

interface ReconConfig {
  anthropicApiKey: string;
  reconSources: string[];
  appBaseUrl: string;
}

interface ReconDigest {
  summary: string;
  signals: Array<{
    source: string;
    headline: string;
    insight: string;
  }>;
  opportunities: Array<{
    type: string;
    description: string;
    priority: "high" | "medium" | "low";
  }>;
  sourcesChecked: string[];
  generatedAt: string;
}

export class ReconAgent {
  private config: ReconConfig;

  constructor(config: ReconConfig) {
    this.config = config;
  }

  async run(): Promise<ReconDigest> {
    log.info(`Checking ${this.config.reconSources.length} sources...`);

    // Fetch content from each source
    const sourceContents: Array<{ source: string; content: string }> = [];

    for (const source of this.config.reconSources) {
      try {
        const content = await this.fetchSource(source);
        if (content) {
          sourceContents.push({ source, content });
          log.info(`Fetched: ${source}`);
        }
      } catch (err) {
        log.warn(`Failed to fetch ${source}: ${err}`);
      }
    }

    if (sourceContents.length === 0) {
      log.warn("No sources fetched — returning empty digest");
      return {
        summary: "No sources could be reached this run.",
        signals: [],
        opportunities: [],
        sourcesChecked: this.config.reconSources,
        generatedAt: new Date().toISOString(),
      };
    }

    // Synthesize with Claude
    const digest = await this.synthesize(sourceContents);

    // Push to dashboard API
    try {
      await fetch(`${this.config.appBaseUrl}/api/recon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          digest_data: {
            summary: digest.summary,
            signals: digest.signals,
          },
          opportunities: digest.opportunities,
          sources_checked: digest.sourcesChecked,
        }),
      });
    } catch {
      log.warn("Failed to push digest to dashboard");
    }

    log.info(
      `Digest: ${digest.signals.length} signals, ${digest.opportunities.length} opportunities`
    );

    return digest;
  }

  private async fetchSource(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; AffiliateEngine/1.0; research bot)",
        },
      });

      if (!res.ok) return null;

      const text = await res.text();
      // Trim to first 15k chars to avoid blowing up Claude context
      return text.slice(0, 15000);
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async synthesize(
    sources: Array<{ source: string; content: string }>
  ): Promise<ReconDigest> {
    const sourceSummaries = sources
      .map(
        (s) =>
          `=== SOURCE: ${s.source} ===\n${s.content.slice(0, 5000)}\n`
      )
      .join("\n");

    const prompt = `Analyze these SEO and affiliate marketing industry sources and produce a weekly intelligence digest.

${sourceSummaries}

Output a JSON object with this exact structure:
{
  "summary": "2-3 sentence overview of this week's key developments",
  "signals": [
    {
      "source": "source domain",
      "headline": "what happened",
      "insight": "what it means for affiliate site operators"
    }
  ],
  "opportunities": [
    {
      "type": "keyword_gap|content_format|affiliate_program|technical_seo|traffic_source",
      "description": "specific actionable opportunity",
      "priority": "high|medium|low"
    }
  ]
}

Focus on signals that affect affiliate site operators:
- Google algorithm changes or ranking factor shifts
- New affiliate programs or commission changes
- Content format trends (video, comparison tables, etc.)
- Keyword opportunity gaps
- Technical SEO requirements

Return ONLY the JSON object, no markdown fencing.`;

    const response = await askClaude(prompt, {
      system:
        "You are an SEO intelligence analyst. Analyze industry sources and extract actionable signals for affiliate site operators. Always respond with valid JSON only.",
      maxTokens: 4000,
    });

    try {
      const parsed = JSON.parse(response);
      return {
        ...parsed,
        sourcesChecked: sources.map((s) => s.source),
        generatedAt: new Date().toISOString(),
      };
    } catch {
      log.error("Failed to parse Claude response as JSON");
      return {
        summary: response.slice(0, 500),
        signals: [],
        opportunities: [],
        sourcesChecked: sources.map((s) => s.source),
        generatedAt: new Date().toISOString(),
      };
    }
  }
}
