import { log } from "../utils";

export interface TrendingTopic {
  keyword: string;
  source: string;
  trafficVolume: string | null;
  relatedQueries: string[];
}

export class TrendsCollector {
  async getDailyTrends(): Promise<TrendingTopic[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(
        "https://trends.google.com/trends/trendingsearches/daily/rss?geo=US",
        {
          signal: controller.signal,
          headers: {
            "User-Agent": "AffiliateEngine/1.0 (research)",
          },
        }
      );

      if (!res.ok) {
        log.warn(`Google Trends RSS returned ${res.status}`);
        return [];
      }

      const xml = await res.text();
      return this.parseTrendsRSS(xml);
    } catch (err) {
      log.warn(`Google Trends fetch failed: ${err}`);
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseTrendsRSS(xml: string): TrendingTopic[] {
    const items: TrendingTopic[] = [];
    const itemPattern = /<item>([\s\S]*?)<\/item>/g;

    let match;
    while ((match = itemPattern.exec(xml)) !== null) {
      const itemXml = match[1];

      const title = this.extractTag(itemXml, "title");
      const traffic = this.extractTag(itemXml, "ht:approx_traffic");
      const newsItems = this.extractTag(itemXml, "ht:news_item_title");

      if (title) {
        items.push({
          keyword: title,
          source: "google-trends-daily",
          trafficVolume: traffic || null,
          relatedQueries: newsItems ? [newsItems] : [],
        });
      }
    }

    return items;
  }

  private extractTag(xml: string, tag: string): string | null {
    const pattern = new RegExp(`<${tag}><!\\[CDATA\\[([^\\]]*?)\\]\\]><\\/${tag}>|<${tag}>([^<]*)<\\/${tag}>`);
    const m = pattern.exec(xml);
    return m ? (m[1] ?? m[2] ?? null) : null;
  }

  async getAutocompleteSuggestions(seed: string): Promise<string[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const encoded = encodeURIComponent(seed);
      const res = await fetch(
        `https://suggestqueries.google.com/complete/search?client=chrome&q=${encoded}`,
        {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        }
      );

      if (!res.ok) return [];

      const data = await res.json();
      // Response format: [query, [suggestions], ...]
      return Array.isArray(data[1]) ? data[1].slice(0, 10) : [];
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  async getBuyerIntentSuggestions(
    niches: string[]
  ): Promise<Record<string, string[]>> {
    const results: Record<string, string[]> = {};
    const modifiers = ["best", "top", "review", "vs", "buy"];

    for (const niche of niches) {
      const suggestions: string[] = [];

      for (const mod of modifiers) {
        const query = `${mod} ${niche}`;
        const sug = await this.getAutocompleteSuggestions(query);
        suggestions.push(...sug);

        // Rate limit — 500ms between autocomplete requests
        await new Promise((r) => setTimeout(r, 500));
      }

      // Deduplicate
      results[niche] = [...new Set(suggestions)];
      log.info(`Trends ${niche}: ${results[niche].length} suggestions`);
    }

    return results;
  }
}
