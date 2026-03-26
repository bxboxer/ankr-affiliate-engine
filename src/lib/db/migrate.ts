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

  console.log("Migrations complete.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
