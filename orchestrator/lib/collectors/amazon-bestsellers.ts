import { log } from "../utils";

export interface AmazonProduct {
  rank: number;
  title: string;
  category: string;
  url: string;
}

const CATEGORY_URLS: Record<string, string> = {
  electronics: "https://www.amazon.com/Best-Sellers-Electronics/zgbs/electronics",
  computers: "https://www.amazon.com/Best-Sellers-Computers-Accessories/zgbs/pc",
  "video-games": "https://www.amazon.com/Best-Sellers-Video-Games/zgbs/videogames",
  "home-kitchen": "https://www.amazon.com/Best-Sellers-Home-Kitchen/zgbs/home-garden",
  "sports-outdoors": "https://www.amazon.com/Best-Sellers-Sports-Outdoors/zgbs/sporting-goods",
  "health-fitness": "https://www.amazon.com/Best-Sellers-Health-Household/zgbs/hpc",
  "tools-home": "https://www.amazon.com/Best-Sellers-Tools-Home-Improvement/zgbs/hi",
  "pet-supplies": "https://www.amazon.com/Best-Sellers-Pet-Supplies/zgbs/pet-supplies",
  "baby": "https://www.amazon.com/Best-Sellers-Baby/zgbs/baby-products",
  "kitchen-dining": "https://www.amazon.com/Best-Sellers-Kitchen-Dining/zgbs/kitchen",
};

const MOVERS_URL = "https://www.amazon.com/gp/movers-and-shakers";

export class AmazonBestSellersCollector {
  private async fetchPage(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!res.ok) return null;
      const text = await res.text();
      return text.slice(0, 50000); // Amazon pages can be large
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseProducts(html: string, category: string): AmazonProduct[] {
    const products: AmazonProduct[] = [];

    // Extract product titles and ranks from Amazon's bestseller pages
    // Amazon uses various patterns; extract what we can reliably
    const titlePattern =
      /class="[^"]*zg-bdg-text[^"]*"[^>]*>#(\d+)<\/span>[\s\S]*?<a[^>]+href="([^"]*)"[^>]*>[\s\S]*?<(?:span|div)[^>]*class="[^"]*p13n-sc-truncat[^"]*"[^>]*>([^<]+)/g;

    let match;
    while ((match = titlePattern.exec(html)) !== null) {
      products.push({
        rank: parseInt(match[1]),
        url: match[2].startsWith("http")
          ? match[2]
          : `https://www.amazon.com${match[2]}`,
        title: match[3].trim(),
        category,
      });
    }

    // Fallback: simpler extraction if the above doesn't match
    if (products.length === 0) {
      const simplePattern =
        /<div[^>]*data-asin="([^"]+)"[\s\S]*?<span[^>]*class="[^"]*zg-text-center-align[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)/g;
      let rank = 1;
      while ((match = simplePattern.exec(html)) !== null) {
        products.push({
          rank: rank++,
          url: `https://www.amazon.com/dp/${match[1]}`,
          title: match[2].trim(),
          category,
        });
      }
    }

    return products.slice(0, 20); // Top 20 per category
  }

  async getTopProducts(
    categories?: string[]
  ): Promise<Record<string, AmazonProduct[]>> {
    const cats = categories ?? Object.keys(CATEGORY_URLS);
    const results: Record<string, AmazonProduct[]> = {};

    for (const cat of cats) {
      const url = CATEGORY_URLS[cat];
      if (!url) {
        log.warn(`Unknown Amazon category: ${cat}`);
        continue;
      }

      const html = await this.fetchPage(url);
      if (html) {
        results[cat] = this.parseProducts(html, cat);
        log.info(`Amazon ${cat}: ${results[cat].length} products`);
      } else {
        log.warn(`Failed to fetch Amazon bestsellers for ${cat}`);
        results[cat] = [];
      }

      // Be polite to Amazon — 2s delay between requests
      await new Promise((r) => setTimeout(r, 2000));
    }

    return results;
  }

  async getMoversAndShakers(): Promise<AmazonProduct[]> {
    const html = await this.fetchPage(MOVERS_URL);
    if (!html) {
      log.warn("Failed to fetch Amazon Movers & Shakers");
      return [];
    }
    return this.parseProducts(html, "movers-and-shakers");
  }
}
