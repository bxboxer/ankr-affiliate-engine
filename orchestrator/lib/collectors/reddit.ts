import { log } from "../utils";

export interface RedditPost {
  subreddit: string;
  title: string;
  selftext: string;
  score: number;
  numComments: number;
  url: string;
  createdUtc: number;
}

export interface RedditBuzz {
  keyword: string;
  mentionCount: number;
  avgScore: number;
  topPosts: RedditPost[];
}

const DEFAULT_SUBREDDITS = [
  "juststart",
  "SEO",
  "affiliatemarketing",
  "Entrepreneur",
  "SideProject",
  "passive_income",
  "NicheWebsites",
  "AmazonReviews",
];

export class RedditCollector {
  private subreddits: string[];

  constructor(subreddits?: string[]) {
    this.subreddits = subreddits ?? DEFAULT_SUBREDDITS;
  }

  async getSubredditPosts(
    subreddit: string,
    limit: number = 25
  ): Promise<RedditPost[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(
        `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`,
        {
          signal: controller.signal,
          headers: {
            "User-Agent": "AffiliateEngine/1.0 (research bot)",
          },
        }
      );

      if (!res.ok) {
        log.warn(`Reddit r/${subreddit} returned ${res.status}`);
        return [];
      }

      const data = await res.json();
      const children = data?.data?.children ?? [];

      return children
        .filter(
          (c: { kind: string; data: { stickied: boolean } }) =>
            c.kind === "t3" && !c.data.stickied
        )
        .map(
          (c: {
            data: {
              subreddit: string;
              title: string;
              selftext: string;
              score: number;
              num_comments: number;
              permalink: string;
              created_utc: number;
            };
          }) => ({
            subreddit: c.data.subreddit,
            title: c.data.title,
            selftext: (c.data.selftext ?? "").slice(0, 1000),
            score: c.data.score,
            numComments: c.data.num_comments,
            url: `https://reddit.com${c.data.permalink}`,
            createdUtc: c.data.created_utc,
          })
        );
    } catch (err) {
      log.warn(`Reddit r/${subreddit} failed: ${err}`);
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  async getAllPosts(): Promise<RedditPost[]> {
    const allPosts: RedditPost[] = [];

    for (const sub of this.subreddits) {
      const posts = await this.getSubredditPosts(sub);
      allPosts.push(...posts);
      log.info(`Reddit r/${sub}: ${posts.length} posts`);

      // Rate limit — 1.5s between requests
      await new Promise((r) => setTimeout(r, 1500));
    }

    return allPosts;
  }

  async searchKeywordBuzz(keywords: string[]): Promise<RedditBuzz[]> {
    const allPosts = await this.getAllPosts();
    const results: RedditBuzz[] = [];

    for (const keyword of keywords) {
      const kw = keyword.toLowerCase();
      const matching = allPosts.filter(
        (p) =>
          p.title.toLowerCase().includes(kw) ||
          p.selftext.toLowerCase().includes(kw)
      );

      if (matching.length > 0) {
        const avgScore =
          matching.reduce((sum, p) => sum + p.score, 0) / matching.length;

        results.push({
          keyword,
          mentionCount: matching.length,
          avgScore: Math.round(avgScore),
          topPosts: matching
            .sort((a, b) => b.score - a.score)
            .slice(0, 5),
        });
      }
    }

    return results.sort((a, b) => b.mentionCount - a.mentionCount);
  }
}
