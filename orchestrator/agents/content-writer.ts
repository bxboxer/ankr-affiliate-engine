import { askClaude } from "../lib/claude";
import { log } from "../lib/utils";
import { GitHubClient } from "../lib/github";

interface WriterConfig {
  anthropicApiKey: string;
  githubOwner: string;
  githubToken: string;
  appBaseUrl: string;
  maxJobsPerRun: number;
}

interface SiteRef {
  id: string;
  name: string;
  domain: string;
  niche: string;
  repo_name: string;
  affiliate_tag: string | null;
  affiliate_program: string;
  audience_description: string | null;
}

interface ContentJob {
  id: string;
  site_id: string;
  job_type: "new_article" | "update" | "rewrite_meta" | "expand";
  title: string;
  slug: string;
  target_keywords: string[] | null;
  source: "research" | "scoring" | "manual";
  brief: string | null;
}

interface GenerationResult {
  jobId: string;
  content: string;
  wordCount: number;
  success: boolean;
  error?: string;
}

const SYSTEM_PROMPT = `You are an expert affiliate content writer who creates high-converting, SEO-optimized articles for review and buying guide websites.

Your articles must:
- Follow E-E-A-T principles (Experience, Expertise, Authority, Trust)
- Use natural, conversational tone — not robotic or overly salesy
- Include a clear frontmatter block at the top (see format below)
- Break content into scannable sections with H2/H3 headings
- Include comparison tables where relevant (markdown tables)
- Add pros/cons lists for products
- Naturally weave in affiliate-relevant buying intent phrases
- Use the affiliate tag provided for Amazon links
- Include a "What to Look For" or "Buying Guide" section
- End with a clear recommendation/conclusion
- Target 1500-3000 words for new articles, 500-1000 for updates/expansions

Frontmatter format (YAML between --- delimiters):
---
title: "Article Title Here"
description: "Meta description for SEO (150-160 chars)"
date: "YYYY-MM-DD"
keywords: ["keyword1", "keyword2", "keyword3"]
category: "category-name"
---

Output ONLY the article content with frontmatter. No explanations or meta-commentary.`;

export class ContentWriter {
  private config: WriterConfig;
  private github: GitHubClient;

  constructor(config: WriterConfig) {
    this.config = config;
    this.github = new GitHubClient(config.githubToken, config.githubOwner);
  }

  async run(
    jobs: ContentJob[],
    sites: SiteRef[]
  ): Promise<GenerationResult[]> {
    const batch = jobs.slice(0, this.config.maxJobsPerRun);
    log.info(
      `Processing ${batch.length} content jobs (${jobs.length} total queued)`
    );

    const results: GenerationResult[] = [];

    for (const job of batch) {
      const site = sites.find((s) => s.id === job.site_id);
      if (!site) {
        log.warn(`Site ${job.site_id} not found for job ${job.id} — skipping`);
        results.push({
          jobId: job.id,
          content: "",
          wordCount: 0,
          success: false,
          error: "Site not found",
        });
        continue;
      }

      try {
        // Update job status to generating
        await this.updateJobStatus(job.id, "generating");

        log.info(
          `Generating: "${job.title}" (${job.job_type}) for ${site.name}`
        );

        // Fetch site's CLAUDE.md for style context
        const siteGuidelines = await this.fetchSiteGuidelines(site.repo_name);

        // Generate article content
        const content = await this.generateContent(job, site, siteGuidelines);
        const wordCount = content
          .split(/\s+/)
          .filter((w) => w.length > 0).length;

        log.info(`Generated ${wordCount} words for "${job.title}"`);

        // Update job with generated content (status: review)
        await this.updateJob(job.id, {
          status: "review",
          generated_content: content,
          word_count: wordCount,
        });

        results.push({
          jobId: job.id,
          content,
          wordCount,
          success: true,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`Failed to generate "${job.title}": ${msg}`);

        await this.updateJob(job.id, {
          status: "failed",
          error_message: msg,
        });

        results.push({
          jobId: job.id,
          content: "",
          wordCount: 0,
          success: false,
          error: msg,
        });
      }
    }

    return results;
  }

  private async generateContent(
    job: ContentJob,
    site: SiteRef,
    siteGuidelines: string | null
  ): Promise<string> {
    const today = new Date().toISOString().split("T")[0];

    let prompt: string;

    switch (job.job_type) {
      case "new_article":
        prompt = this.buildNewArticlePrompt(job, site, today);
        break;
      case "update":
        prompt = this.buildUpdatePrompt(job, site);
        break;
      case "expand":
        prompt = this.buildExpandPrompt(job, site);
        break;
      case "rewrite_meta":
        prompt = this.buildRewriteMetaPrompt(job, site);
        break;
    }

    const systemPrompt = siteGuidelines
      ? `${SYSTEM_PROMPT}\n\n--- SITE-SPECIFIC GUIDELINES ---\n${siteGuidelines}`
      : SYSTEM_PROMPT;

    return askClaude(prompt, {
      system: systemPrompt,
      maxTokens: 8192,
      model: "claude-sonnet-4-20250514",
    });
  }

  private buildNewArticlePrompt(
    job: ContentJob,
    site: SiteRef,
    today: string
  ): string {
    const keywords = job.target_keywords?.join(", ") ?? "none specified";
    const tag = site.affiliate_tag ?? "yourtag-20";

    return `Write a comprehensive affiliate review/buying guide article.

ARTICLE DETAILS:
- Title: ${job.title}
- Target keywords: ${keywords}
- Date: ${today}
- Site niche: ${site.niche}
- Target audience: ${site.audience_description ?? "general consumers"}
- Affiliate program: ${site.affiliate_program}
- Amazon affiliate tag: ${tag}

${job.brief ? `RESEARCH BRIEF:\n${job.brief}\n` : ""}
REQUIREMENTS:
- 1500-3000 words
- Include comparison table of top 3-5 products
- Each product section: overview, pros/cons, who it's best for, Amazon link placeholder
- Amazon links format: https://www.amazon.com/dp/ASIN?tag=${tag}
- Use real product knowledge — recommend actual popular products in this category
- Include "What to Look For" buying guide section
- Write the frontmatter with the exact title, a compelling meta description, and the target keywords
- Category in frontmatter: use a slug derived from the site niche (e.g., "gaming-headsets")`;
  }

  private buildUpdatePrompt(job: ContentJob, site: SiteRef): string {
    return `Update and improve the following article to rank better in search.

ARTICLE: ${job.title}
URL: ${job.slug}
Site: ${site.name} (${site.domain})
Niche: ${site.niche}

${job.brief ? `SCORING BRIEF:\n${job.brief}\n` : ""}
REQUIREMENTS:
- Update product recommendations with current 2024-2025 models
- Improve content depth and E-E-A-T signals
- Add or update comparison tables
- Improve internal linking suggestions (mention as HTML comments)
- Refresh the meta description for better CTR
- Target 500-1000 additional words of improvement
- Keep the same frontmatter title unless it needs improvement for CTR
- Amazon affiliate tag: ${site.affiliate_tag ?? "yourtag-20"}`;
  }

  private buildExpandPrompt(job: ContentJob, site: SiteRef): string {
    return `Expand this high-performing article with additional related content.

ARTICLE: ${job.title}
URL: ${job.slug}
Site: ${site.name} (${site.domain})
Niche: ${site.niche}

${job.brief ? `SCORING BRIEF:\n${job.brief}\n` : ""}
REQUIREMENTS:
- This article is already ranking well — expand it to capture more queries
- Add 2-3 new sections covering related sub-topics
- Add an FAQ section (use schema-friendly ## FAQ format)
- Add more product comparisons or alternatives
- Target 800-1200 additional words
- Maintain the existing tone and quality
- Amazon affiliate tag: ${site.affiliate_tag ?? "yourtag-20"}`;
  }

  private buildRewriteMetaPrompt(job: ContentJob, site: SiteRef): string {
    return `Rewrite the title and meta description for this page to improve click-through rate.

ARTICLE: ${job.title}
URL: ${job.slug}
Site: ${site.name} (${site.domain})
Niche: ${site.niche}

${job.brief ? `SCORING BRIEF:\n${job.brief}\n` : ""}
REQUIREMENTS:
- Write 3 alternative titles (focus on click-worthiness and keyword inclusion)
- Write 3 alternative meta descriptions (150-160 chars, include call-to-action)
- Explain why each option would improve CTR
- Format as frontmatter with the recommended best option
- Keep it concise — this is metadata only, not a full article`;
  }

  private async fetchSiteGuidelines(
    repoName: string
  ): Promise<string | null> {
    try {
      const response = await this.github.getFileContent(repoName, "CLAUDE.md");
      return response;
    } catch {
      log.info(`No CLAUDE.md found for ${repoName} — using defaults`);
      return null;
    }
  }

  private async updateJobStatus(
    jobId: string,
    status: string
  ): Promise<void> {
    await this.updateJob(jobId, { status });
  }

  private async updateJob(
    jobId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      await fetch(`${this.config.appBaseUrl}/api/content/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (err) {
      log.warn(`Failed to update job ${jobId}: ${err}`);
    }
  }
}
