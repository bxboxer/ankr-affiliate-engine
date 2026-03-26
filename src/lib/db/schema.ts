import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

// ── Sites ────────────────────────────────────────────────────────────────────

export interface SitesTable {
  id: Generated<string>;
  name: string;
  domain: string;
  niche: string;
  status: "active" | "spawning" | "paused" | "archived";
  repo_name: string;
  vercel_project_id: string | null;
  affiliate_tag: string | null;
  affiliate_program: string;
  audience_description: string | null;
  target_keywords: string[] | null; // stored as jsonb
  monthly_traffic: number | null;
  monthly_revenue: number | null;
  last_scored_at: ColumnType<Date, string | undefined, string>;
  created_at: ColumnType<Date, string | undefined, string>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export type Site = Selectable<SitesTable>;
export type NewSite = Insertable<SitesTable>;
export type SiteUpdate = Updateable<SitesTable>;

// ── Scoring Reports ──────────────────────────────────────────────────────────

export interface ScoringReportsTable {
  id: Generated<string>;
  site_id: string;
  total_pages: number;
  pages_to_prune: number;
  pages_to_update: number;
  pages_to_expand: number;
  pages_to_rewrite_meta: number;
  report_data: unknown; // jsonb — full scoring breakdown
  created_at: ColumnType<Date, string | undefined, string>;
}

export type ScoringReport = Selectable<ScoringReportsTable>;
export type NewScoringReport = Insertable<ScoringReportsTable>;

// ── Recon Digests ────────────────────────────────────────────────────────────

export interface ReconDigestsTable {
  id: Generated<string>;
  digest_data: unknown; // jsonb — full recon output
  opportunities: unknown; // jsonb — extracted opportunities
  sources_checked: string[];
  created_at: ColumnType<Date, string | undefined, string>;
}

export type ReconDigest = Selectable<ReconDigestsTable>;
export type NewReconDigest = Insertable<ReconDigestsTable>;

// ── Spawn Queue ──────────────────────────────────────────────────────────────

export interface SpawnQueueTable {
  id: Generated<string>;
  name: string;
  domain: string;
  niche: string;
  audience_description: string | null;
  affiliate_program: string;
  affiliate_tag: string | null;
  target_keywords: string[] | null;
  status: "queued" | "spawning" | "completed" | "failed";
  error_message: string | null;
  created_at: ColumnType<Date, string | undefined, string>;
}

export type SpawnQueueItem = Selectable<SpawnQueueTable>;
export type NewSpawnQueueItem = Insertable<SpawnQueueTable>;

// ── Niche Research ───────────────────────────────────────────────────────────

export interface NicheResearchTable {
  id: Generated<string>;
  niche_name: string;
  category: string;
  consensus_score: number;
  search_volume_avg: number | null;
  avg_cpc: number | null; // stored in cents
  competition_level: string | null;
  trending_score: number | null;
  reddit_buzz_score: number | null;
  amazon_demand_score: number | null;
  keyword_data: unknown; // jsonb — raw keyword planner results
  amazon_data: unknown; // jsonb — bestseller/trending product data
  reddit_data: unknown; // jsonb — Reddit thread/mention data
  trend_data: unknown; // jsonb — trend analysis data
  claude_analysis: unknown; // jsonb — Claude's synthesis and reasoning
  top_keywords: string[]; // jsonb — best keyword opportunities
  top_products: unknown; // jsonb — best product opportunities
  sources_used: string[]; // jsonb — which data sources contributed
  site_id: string | null;
  status: "pending" | "complete" | "stale";
  created_at: ColumnType<Date, string | undefined, string>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export type NicheResearch = Selectable<NicheResearchTable>;
export type NewNicheResearch = Insertable<NicheResearchTable>;
export type NicheResearchUpdate = Updateable<NicheResearchTable>;

// ── Database ─────────────────────────────────────────────────────────────────

export interface Database {
  sites: SitesTable;
  scoring_reports: ScoringReportsTable;
  recon_digests: ReconDigestsTable;
  spawn_queue: SpawnQueueTable;
  niche_research: NicheResearchTable;
}
