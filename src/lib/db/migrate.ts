import { config } from "dotenv";
config();

import { sql } from "kysely";
import { db } from "./index";

async function migrate() {
  console.log("Running migrations...");

  await db.schema
    .createTable("sites")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("domain", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("niche", "varchar(255)", (col) => col.notNull())
    .addColumn("status", "varchar(50)", (col) =>
      col.notNull().defaultTo("active")
    )
    .addColumn("repo_name", "varchar(255)", (col) => col.notNull())
    .addColumn("vercel_project_id", "varchar(255)")
    .addColumn("affiliate_tag", "varchar(255)")
    .addColumn("affiliate_program", "varchar(100)", (col) =>
      col.notNull().defaultTo("amazon")
    )
    .addColumn("audience_description", "text")
    .addColumn("target_keywords", "jsonb")
    .addColumn("monthly_traffic", "integer")
    .addColumn("monthly_revenue", "integer")
    .addColumn("last_scored_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createTable("scoring_reports")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("site_id", "uuid", (col) =>
      col.notNull().references("sites.id").onDelete("cascade")
    )
    .addColumn("total_pages", "integer", (col) => col.notNull())
    .addColumn("pages_to_prune", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("pages_to_update", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("pages_to_expand", "integer", (col) =>
      col.notNull().defaultTo(0)
    )
    .addColumn("pages_to_rewrite_meta", "integer", (col) =>
      col.notNull().defaultTo(0)
    )
    .addColumn("report_data", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createTable("recon_digests")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("digest_data", "jsonb")
    .addColumn("opportunities", "jsonb")
    .addColumn("sources_checked", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createTable("spawn_queue")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("domain", "varchar(255)", (col) => col.notNull())
    .addColumn("niche", "varchar(255)", (col) => col.notNull())
    .addColumn("audience_description", "text")
    .addColumn("affiliate_program", "varchar(100)", (col) =>
      col.notNull().defaultTo("amazon")
    )
    .addColumn("affiliate_tag", "varchar(255)")
    .addColumn("target_keywords", "jsonb")
    .addColumn("status", "varchar(50)", (col) =>
      col.notNull().defaultTo("queued")
    )
    .addColumn("error_message", "text")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createTable("niche_research")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("niche_name", "varchar(255)", (col) => col.notNull())
    .addColumn("category", "varchar(100)", (col) => col.notNull())
    .addColumn("consensus_score", "integer", (col) =>
      col.notNull().defaultTo(0)
    )
    .addColumn("search_volume_avg", "integer")
    .addColumn("avg_cpc", "integer")
    .addColumn("competition_level", "varchar(20)")
    .addColumn("trending_score", "integer")
    .addColumn("reddit_buzz_score", "integer")
    .addColumn("amazon_demand_score", "integer")
    .addColumn("keyword_data", "jsonb")
    .addColumn("amazon_data", "jsonb")
    .addColumn("reddit_data", "jsonb")
    .addColumn("trend_data", "jsonb")
    .addColumn("claude_analysis", "jsonb")
    .addColumn("top_keywords", "jsonb")
    .addColumn("top_products", "jsonb")
    .addColumn("sources_used", "jsonb")
    .addColumn("site_id", "uuid", (col) =>
      col.references("sites.id").onDelete("set null")
    )
    .addColumn("status", "varchar(20)", (col) =>
      col.notNull().defaultTo("pending")
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Indexes
  await db.schema
    .createIndex("idx_sites_status")
    .ifNotExists()
    .on("sites")
    .column("status")
    .execute();

  await db.schema
    .createIndex("idx_scoring_reports_site_id")
    .ifNotExists()
    .on("scoring_reports")
    .column("site_id")
    .execute();

  await db.schema
    .createIndex("idx_spawn_queue_status")
    .ifNotExists()
    .on("spawn_queue")
    .column("status")
    .execute();

  await db.schema
    .createIndex("idx_niche_research_category")
    .ifNotExists()
    .on("niche_research")
    .column("category")
    .execute();

  await db.schema
    .createIndex("idx_niche_research_score")
    .ifNotExists()
    .on("niche_research")
    .column("consensus_score")
    .execute();

  await db.schema
    .createIndex("idx_niche_research_site_id")
    .ifNotExists()
    .on("niche_research")
    .column("site_id")
    .execute();

  // ── Content Jobs ────────────────────────────────────────────────────────
  await db.schema
    .createTable("content_jobs")
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("site_id", "uuid", (col) =>
      col.notNull().references("sites.id").onDelete("cascade")
    )
    .addColumn("job_type", "varchar(50)", (col) => col.notNull())
    .addColumn("title", "varchar(500)", (col) => col.notNull())
    .addColumn("slug", "varchar(500)", (col) => col.notNull())
    .addColumn("target_keywords", "jsonb")
    .addColumn("source", "varchar(50)", (col) => col.notNull())
    .addColumn("source_id", "uuid")
    .addColumn("brief", "text")
    .addColumn("generated_content", "text")
    .addColumn("word_count", "integer")
    .addColumn("status", "varchar(50)", (col) =>
      col.notNull().defaultTo("queued")
    )
    .addColumn("error_message", "text")
    .addColumn("commit_sha", "varchar(255)")
    .addColumn("published_url", "varchar(500)")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("published_at", "timestamptz")
    .execute();

  await db.schema
    .createIndex("idx_content_jobs_site_id")
    .ifNotExists()
    .on("content_jobs")
    .column("site_id")
    .execute();

  await db.schema
    .createIndex("idx_content_jobs_status")
    .ifNotExists()
    .on("content_jobs")
    .column("status")
    .execute();

  await db.schema
    .createIndex("idx_content_jobs_source")
    .ifNotExists()
    .on("content_jobs")
    .column("source")
    .execute();

  console.log("Migrations complete.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
