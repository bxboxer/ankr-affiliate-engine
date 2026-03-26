import { GitHubClient } from "../lib/github";
import { VercelClient } from "../lib/vercel";
import { askClaude } from "../lib/claude";
import { log } from "../lib/utils";

interface SpawnConfig {
  githubOwner: string;
  githubToken: string;
  vercelToken: string;
  vercelTeamId?: string;
  templateRepo: string;
}

interface SpawnRequest {
  id: string;
  name: string;
  domain: string;
  niche: string;
  audience_description?: string;
  affiliate_program: string;
  affiliate_tag?: string;
  target_keywords?: string[];
}

export class SiteSpawner {
  private github: GitHubClient;
  private vercel: VercelClient;
  private config: SpawnConfig;

  constructor(config: SpawnConfig) {
    this.config = config;
    this.github = new GitHubClient(config.githubToken, config.githubOwner);
    this.vercel = new VercelClient(config.vercelToken, config.vercelTeamId);
  }

  async spawn(
    request: SpawnRequest
  ): Promise<{ name: string; success: boolean; repoUrl?: string; vercelUrl?: string; error?: string }> {
    const repoName = `ankr-${request.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    try {
      // 1. Clone template repo
      log.info(`Creating repo: ${this.config.githubOwner}/${repoName}`);
      await this.github.createRepoFromTemplate(
        this.config.templateRepo,
        repoName,
        `${request.niche} — Affiliate site managed by ANKR Affiliate Engine`
      );

      // Wait for GitHub to finish template generation
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 2. Generate site-specific CLAUDE.md using AI
      log.info("Generating CLAUDE.md...");
      const claudeMd = await this.generateClaudeMd(request);
      await this.github.createOrUpdateFile(
        repoName,
        "CLAUDE.md",
        claudeMd,
        "Add site-specific CLAUDE.md for Claude Code agents"
      );

      // 3. Create Vercel project
      log.info("Creating Vercel project...");
      const project = await this.vercel.createProject(repoName, {
        owner: this.config.githubOwner,
        repo: repoName,
      });

      // 4. Add custom domain
      if (request.domain) {
        log.info(`Adding domain: ${request.domain}`);
        try {
          await this.vercel.addDomain(project.id, request.domain);
        } catch (err) {
          log.warn(`Domain add failed (configure DNS manually): ${err}`);
        }
      }

      return {
        name: request.name,
        success: true,
        repoUrl: `https://github.com/${this.config.githubOwner}/${repoName}`,
        vercelUrl: `https://${repoName}.vercel.app`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Spawn failed for ${request.name}: ${msg}`);
      return { name: request.name, success: false, error: msg };
    }
  }

  private async generateClaudeMd(request: SpawnRequest): Promise<string> {
    const prompt = `Generate a CLAUDE.md file for a Claude Code agent working on an affiliate review site.

Site details:
- Name: ${request.name}
- Domain: ${request.domain}
- Niche: ${request.niche}
- Audience: ${request.audience_description ?? "General consumers"}
- Affiliate Program: ${request.affiliate_program}
- Affiliate Tag: ${request.affiliate_tag ?? "N/A"}
- Target Keywords: ${request.target_keywords?.join(", ") ?? "N/A"}

The CLAUDE.md should include:
1. Project identity and niche context
2. Content rules (tone, structure, affiliate disclosure requirements)
3. SEO guidelines (schema markup, internal linking, keyword density)
4. Affiliate link formatting rules
5. Quality gates (what to check before publishing)
6. A "STOP AND ASK" section for when the agent should pause and ask the human

Format it as a clean markdown document. Be specific and actionable, not generic.`;

    return askClaude(prompt, {
      system:
        "You are an expert at configuring AI coding agents for affiliate marketing sites. Output clean, actionable CLAUDE.md files.",
      maxTokens: 3000,
    });
  }
}
