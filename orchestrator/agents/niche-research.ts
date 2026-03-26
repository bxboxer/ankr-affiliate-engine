import { askClaude } from "../lib/claude";
import { log } from "../lib/utils";
import { KeywordPlannerCollector, type KeywordIdea } from "../lib/collectors/keyword-planner";
import { AmazonBestSellersCollector, type AmazonProduct } from "../lib/collectors/amazon-bestsellers";
import { RedditCollector, type RedditPost } from "../lib/collectors/reddit";
import { TrendsCollector, type TrendingTopic } from "../lib/collectors/trends";

interface NicheResearchConfig {
  anthropicApiKey: string;
  appBaseUrl: string;
  seedNiches: string[];
  siteId?: string;
}

interface NicheOpportunity {
  niche_name: string;
  category: string;
  consensus_score: number;
  search_volume_avg: number | null;
  avg_cpc: number | null;
  competition_level: string | null;
  trending_score: number | null;
  reddit_buzz_score: number | null;
  amazon_demand_score: number | null;
  keyword_data: object;
  amazon_data: object;
  reddit_data: object;
  trend_data: object;
  claude_analysis: object;
  top_keywords: string[];
  top_products: object[];
  sources_used: string[];
  site_id: string | null;
  status: "complete";
}

export class NicheResearchAgent {
  private config: NicheResearchConfig;

  constructor(config: NicheResearchConfig) {
    this.config = config;
  }

  async run(): Promise<NicheOpportunity[]> {
    log.info(`Starting niche research for ${this.config.seedNiches.length} seed niches...`);

    // Phase 1: Gather data from all sources in parallel
    const [keywordResult, amazonResult, redditResult, trendResult] =
      await Promise.allSettled([
        this.gatherKeywordData(),
        this.gatherAmazonData(),
        this.gatherRedditData(),
        this.gatherTrendData(),
      ]);

    const keywordData =
      keywordResult.status === "fulfilled" ? keywordResult.value : {};
    const amazonData =
      amazonResult.status === "fulfilled" ? amazonResult.value : {};
    const redditData =
      redditResult.status === "fulfilled" ? redditResult.value : [];
    const trendData =
      trendResult.status === "fulfilled" ? trendResult.value : { trends: [], suggestions: {} };

    const sourcesUsed: string[] = [];
    if (Object.keys(keywordData).length > 0) sourcesUsed.push("google-keyword-planner");
    if (Object.keys(amazonData).length > 0) sourcesUsed.push("amazon-bestsellers");
    if (redditData.length > 0) sourcesUsed.push("reddit");
    if (trendData.trends.length > 0 || Object.keys(trendData.suggestions).length > 0)
      sourcesUsed.push("google-trends");

    log.info(`Data gathered from ${sourcesUsed.length} sources: ${sourcesUsed.join(", ")}`);

    // Phase 2: Build context and synthesize with Claude
    const context = this.buildContext(keywordData, amazonData, redditData, trendData);
    const opportunities = await this.synthesize(context, sourcesUsed);

    // Phase 3: Push results to dashboard API
    let pushed = 0;
    for (const opp of opportunities) {
      try {
        const res = await fetch(`${this.config.appBaseUrl}/api/research`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opp),
        });
        if (res.ok) pushed++;
      } catch {
        log.warn(`Failed to push: ${opp.niche_name}`);
      }
    }

    log.info(`Research complete: ${opportunities.length} niches scored, ${pushed} pushed to dashboard`);
    return opportunities;
  }

  private async gatherKeywordData(): Promise<Record<string, KeywordIdea[]>> {
    log.info("Gathering keyword data...");
    const collector = new KeywordPlannerCollector();
    const results: Record<string, KeywordIdea[]> = {};

    // Batch seed niches into groups of 3 to stay within API limits
    for (const niche of this.config.seedNiches) {
      const ideas = await collector.getKeywordIdeas([niche]);
      if (ideas.length > 0) {
        results[niche] = ideas.slice(0, 30); // Top 30 per niche
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    return results;
  }

  private async gatherAmazonData(): Promise<Record<string, AmazonProduct[]>> {
    log.info("Gathering Amazon bestseller data...");
    const collector = new AmazonBestSellersCollector();

    // Map seed niches to Amazon categories
    const categoryMap: Record<string, string> = {
      "gaming peripherals": "video-games",
      "home office equipment": "computers",
      "smart home devices": "electronics",
      "fitness equipment": "sports-outdoors",
      "outdoor gear": "sports-outdoors",
      "pet supplies": "pet-supplies",
      "kitchen gadgets": "kitchen-dining",
      "baby products": "baby",
    };

    const categories = [
      ...new Set(this.config.seedNiches.map((n) => categoryMap[n]).filter(Boolean)),
    ];

    return collector.getTopProducts(categories);
  }

  private async gatherRedditData(): Promise<RedditPost[]> {
    log.info("Gathering Reddit data...");
    const collector = new RedditCollector();
    return collector.getAllPosts();
  }

  private async gatherTrendData(): Promise<{
    trends: TrendingTopic[];
    suggestions: Record<string, string[]>;
  }> {
    log.info("Gathering trend data...");
    const collector = new TrendsCollector();

    const [trends, suggestions] = await Promise.allSettled([
      collector.getDailyTrends(),
      collector.getBuyerIntentSuggestions(this.config.seedNiches.slice(0, 5)),
    ]);

    return {
      trends: trends.status === "fulfilled" ? trends.value : [],
      suggestions: suggestions.status === "fulfilled" ? suggestions.value : {},
    };
  }

  private buildContext(
    keywordData: Record<string, KeywordIdea[]>,
    amazonData: Record<string, AmazonProduct[]>,
    redditPosts: RedditPost[],
    trendData: { trends: TrendingTopic[]; suggestions: Record<string, string[]> }
  ): string {
    const sections: string[] = [];

    // Keyword Planner data
    if (Object.keys(keywordData).length > 0) {
      sections.push("=== GOOGLE KEYWORD PLANNER DATA ===");
      for (const [niche, ideas] of Object.entries(keywordData)) {
        const top10 = ideas.slice(0, 10);
        sections.push(`\nNiche: ${niche}`);
        for (const kw of top10) {
          const cpcDollars = (kw.highTopOfPageBidMicros / 1_000_000).toFixed(2);
          sections.push(
            `  - "${kw.keyword}" | vol: ${kw.avgMonthlySearches} | competition: ${kw.competition} (${kw.competitionIndex}/100) | CPC: $${cpcDollars}`
          );
        }
      }
    }

    // Amazon data
    if (Object.keys(amazonData).length > 0) {
      sections.push("\n=== AMAZON BESTSELLERS ===");
      for (const [cat, products] of Object.entries(amazonData)) {
        sections.push(`\nCategory: ${cat}`);
        for (const p of products.slice(0, 10)) {
          sections.push(`  #${p.rank}: ${p.title}`);
        }
      }
    }

    // Reddit data
    if (redditPosts.length > 0) {
      sections.push("\n=== REDDIT DISCUSSIONS ===");
      const topPosts = redditPosts
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
      for (const p of topPosts) {
        sections.push(
          `  [r/${p.subreddit}] (score: ${p.score}, ${p.numComments} comments) ${p.title}`
        );
        if (p.selftext) {
          sections.push(`    ${p.selftext.slice(0, 200)}`);
        }
      }
    }

    // Trend data
    if (trendData.trends.length > 0) {
      sections.push("\n=== GOOGLE TRENDS (Daily US) ===");
      for (const t of trendData.trends.slice(0, 20)) {
        sections.push(
          `  - ${t.keyword} (${t.trafficVolume ?? "N/A"} searches)`
        );
      }
    }

    if (Object.keys(trendData.suggestions).length > 0) {
      sections.push("\n=== BUYER INTENT AUTOCOMPLETE ===");
      for (const [niche, sugs] of Object.entries(trendData.suggestions)) {
        sections.push(`\nNiche: ${niche}`);
        for (const s of sugs.slice(0, 10)) {
          sections.push(`  - ${s}`);
        }
      }
    }

    return sections.join("\n");
  }

  private async synthesize(
    context: string,
    sourcesUsed: string[]
  ): Promise<NicheOpportunity[]> {
    // Truncate context to stay within reasonable token limits
    const truncated = context.slice(0, 25000);

    const prompt = `You are a data-driven affiliate marketing analyst. Analyze the following multi-source research data and identify the top niche opportunities for building affiliate review sites.

${truncated}

Based on ALL available data sources, score and rank niche opportunities. For each niche, produce a consensus score (0-100) using this weighting:
- Search demand (25%): Higher search volume = higher score
- CPC / monetization potential (20%): Higher CPC = more advertiser competition = profitable niche
- Low competition feasibility (20%): Lower competition = easier to rank
- Trending momentum (15%): Rising interest from trends and Reddit buzz
- Amazon product availability (10%): More bestselling products = more to review
- Community interest (10%): Reddit discussions indicate engaged buyer audiences

Output a JSON array of niche opportunity objects. Each object must have:
{
  "niche_name": "specific niche name",
  "category": "broad category (gaming, home, fitness, tech, outdoor, pets, kitchen, baby)",
  "consensus_score": 0-100,
  "search_volume_avg": average monthly searches across top keywords (number or null),
  "avg_cpc": average CPC in cents (number or null),
  "competition_level": "LOW" | "MEDIUM" | "HIGH" | null,
  "trending_score": 0-100 based on trend signals (number or null),
  "reddit_buzz_score": 0-100 based on Reddit activity (number or null),
  "amazon_demand_score": 0-100 based on Amazon product availability (number or null),
  "top_keywords": ["top 5 buyer-intent keywords for this niche"],
  "top_products": [{"title": "product name", "why": "why it's good to review"}],
  "reasoning": "2-3 sentences explaining the consensus score"
}

Rules:
- Identify 8-15 distinct niche opportunities
- Rank by consensus_score descending
- Focus on BUYER INTENT niches (people looking to purchase, not just browse)
- Be specific: "gaming monitors under $500" is better than "electronics"
- Cross-reference multiple sources — consensus signals from 2+ sources score higher
- Return ONLY the JSON array, no markdown fencing`;

    const response = await askClaude(prompt, {
      system:
        "You are an affiliate marketing research analyst. Analyze multi-source data and output structured JSON scoring niche opportunities. Always return valid JSON arrays only.",
      maxTokens: 8000,
    });

    try {
      const parsed = JSON.parse(response) as Array<{
        niche_name: string;
        category: string;
        consensus_score: number;
        search_volume_avg: number | null;
        avg_cpc: number | null;
        competition_level: string | null;
        trending_score: number | null;
        reddit_buzz_score: number | null;
        amazon_demand_score: number | null;
        top_keywords: string[];
        top_products: object[];
        reasoning: string;
      }>;

      return parsed.map((item) => ({
        niche_name: item.niche_name,
        category: item.category,
        consensus_score: Math.max(0, Math.min(100, item.consensus_score)),
        search_volume_avg: item.search_volume_avg,
        avg_cpc: item.avg_cpc,
        competition_level: item.competition_level,
        trending_score: item.trending_score,
        reddit_buzz_score: item.reddit_buzz_score,
        amazon_demand_score: item.amazon_demand_score,
        keyword_data: {},
        amazon_data: {},
        reddit_data: {},
        trend_data: {},
        claude_analysis: { reasoning: item.reasoning },
        top_keywords: item.top_keywords ?? [],
        top_products: item.top_products ?? [],
        sources_used: sourcesUsed,
        site_id: this.config.siteId ?? null,
        status: "complete" as const,
      }));
    } catch {
      log.error("Failed to parse Claude synthesis response");
      return [];
    }
  }
}
