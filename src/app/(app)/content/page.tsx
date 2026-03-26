export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { sql } from "kysely";
import Link from "next/link";
import {
  RiFileTextLine,
  RiEditLine,
  RiExpandUpDownLine,
  RiPriceTagLine,
  RiCheckLine,
  RiCloseLine,
  RiTimeLine,
  RiRocketLine,
  RiLightbulbLine,
  RiBarChartLine,
} from "react-icons/ri";
import { generateFromResearch, generateFromScoring } from "./actions";

async function getContentData(status?: string) {
  try {
    let query = db
      .selectFrom("content_jobs")
      .innerJoin("sites", "sites.id", "content_jobs.site_id")
      .select([
        "content_jobs.id",
        "content_jobs.title",
        "content_jobs.slug",
        "content_jobs.job_type",
        "content_jobs.source",
        "content_jobs.status",
        "content_jobs.word_count",
        "content_jobs.target_keywords",
        "content_jobs.published_url",
        "content_jobs.commit_sha",
        "content_jobs.created_at",
        "content_jobs.published_at",
        "content_jobs.error_message",
        "sites.name as site_name",
        "sites.domain as site_domain",
      ])
      .orderBy("content_jobs.created_at", "desc")
      .limit(100);

    if (status && status !== "all") {
      query = query.where(
        "content_jobs.status",
        "=",
        status as "queued" | "generating" | "review" | "published" | "failed"
      );
    }

    const jobs = await query.execute();

    const stats = await db
      .selectFrom("content_jobs")
      .select([
        sql<number>`count(*)`.as("total"),
        sql<number>`count(*) filter (where status = 'queued')`.as("queued"),
        sql<number>`count(*) filter (where status = 'generating')`.as(
          "generating"
        ),
        sql<number>`count(*) filter (where status = 'review')`.as("review"),
        sql<number>`count(*) filter (where status = 'published')`.as(
          "published"
        ),
        sql<number>`count(*) filter (where status = 'failed')`.as("failed"),
        sql<number>`coalesce(sum(word_count) filter (where status = 'published'), 0)`.as(
          "total_words"
        ),
      ])
      .executeTakeFirst();

    const sites = await db
      .selectFrom("sites")
      .select(["id", "name"])
      .where("status", "=", "active")
      .execute();

    return { jobs, stats, sites };
  } catch {
    return {
      jobs: [],
      stats: {
        total: 0,
        queued: 0,
        generating: 0,
        review: 0,
        published: 0,
        failed: 0,
        total_words: 0,
      },
      sites: [],
    };
  }
}

const JOB_TYPE_ICON: Record<string, React.ReactNode> = {
  new_article: <RiFileTextLine className="h-3.5 w-3.5" />,
  update: <RiEditLine className="h-3.5 w-3.5" />,
  expand: <RiExpandUpDownLine className="h-3.5 w-3.5" />,
  rewrite_meta: <RiPriceTagLine className="h-3.5 w-3.5" />,
};

const JOB_TYPE_LABEL: Record<string, string> = {
  new_article: "New Article",
  update: "Update",
  expand: "Expand",
  rewrite_meta: "Rewrite Meta",
};

const STATUS_BADGE: Record<string, string> = {
  queued: "badge-ghost",
  generating: "badge-info",
  review: "badge-warning",
  published: "badge-success",
  failed: "badge-error",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  queued: <RiTimeLine className="h-3 w-3" />,
  generating: <RiRocketLine className="h-3 w-3" />,
  review: <RiEditLine className="h-3 w-3" />,
  published: <RiCheckLine className="h-3 w-3" />,
  failed: <RiCloseLine className="h-3 w-3" />,
};

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: filterStatus } = await searchParams;
  const { jobs, stats, sites } = await getContentData(filterStatus);

  const tabs = [
    { label: "All", value: "all", count: stats?.total ?? 0 },
    { label: "Queued", value: "queued", count: stats?.queued ?? 0 },
    {
      label: "Generating",
      value: "generating",
      count: stats?.generating ?? 0,
    },
    { label: "Review", value: "review", count: stats?.review ?? 0 },
    { label: "Published", value: "published", count: stats?.published ?? 0 },
    { label: "Failed", value: "failed", count: stats?.failed ?? 0 },
  ];

  const activeTab = filterStatus || "all";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Content Pipeline</h1>
          <p className="text-base-content/60">
            AI-generated articles from research and scoring data.
            {stats && Number(stats.total_words) > 0 && (
              <span className="ml-2 text-sm">
                {Number(stats.total_words).toLocaleString()} words published
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {sites.length > 0 && (
            <>
              <GenerateButton
                label="From Research"
                icon={<RiLightbulbLine className="h-4 w-4" />}
                siteId={sites[0].id}
                source="research"
              />
              <GenerateButton
                label="From Scoring"
                icon={<RiBarChartLine className="h-4 w-4" />}
                siteId={sites[0].id}
                source="scoring"
              />
            </>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={
              tab.value === "all"
                ? "/content"
                : `/content?status=${tab.value}`
            }
            className={`card bg-base-100 transition-all hover:shadow-md ${
              activeTab === tab.value ? "ring-2 ring-primary" : ""
            }`}
          >
            <div className="card-body p-3 text-center">
              <p className="text-xs text-base-content/60">{tab.label}</p>
              <p className="text-xl font-bold">{tab.count}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Content Jobs List */}
      {jobs.length === 0 ? (
        <div className="card bg-base-100">
          <div className="card-body items-center py-12 text-center">
            <RiFileTextLine className="h-12 w-12 text-base-content/20" />
            <h3 className="text-lg font-semibold">No content jobs yet</h3>
            <p className="text-base-content/60 max-w-md">
              Generate content from niche research or scoring reports. The AI
              will write full affiliate articles and publish them to your sites.
            </p>
            {sites.length > 0 && (
              <div className="mt-4 flex gap-2">
                <GenerateButton
                  label="Generate from Research"
                  icon={<RiLightbulbLine className="h-4 w-4" />}
                  siteId={sites[0].id}
                  source="research"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const keywords = job.target_keywords as string[] | null;
            return (
              <Link
                key={job.id}
                href={`/content/${job.id}`}
                className="card bg-base-100 transition-all hover:shadow-md"
              >
                <div className="card-body flex-row items-center gap-4 p-4">
                  {/* Type Icon */}
                  <div className="rounded-lg bg-base-200 p-2.5">
                    {JOB_TYPE_ICON[job.job_type]}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-medium">{job.title}</h3>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-base-content/60">
                      <span>{job.site_name}</span>
                      <span className="text-base-content/30">|</span>
                      <span>{JOB_TYPE_LABEL[job.job_type]}</span>
                      <span className="text-base-content/30">|</span>
                      <span className="capitalize">{job.source}</span>
                      {job.word_count && (
                        <>
                          <span className="text-base-content/30">|</span>
                          <span>
                            {job.word_count.toLocaleString()} words
                          </span>
                        </>
                      )}
                    </div>
                    {keywords && keywords.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {keywords.slice(0, 4).map((kw, i) => (
                          <span
                            key={i}
                            className="badge badge-outline badge-xs"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Status + Date */}
                  <div className="text-right">
                    <span
                      className={`badge badge-sm gap-1 ${STATUS_BADGE[job.status]}`}
                    >
                      {STATUS_ICON[job.status]}
                      {job.status}
                    </span>
                    <p className="mt-1 text-xs text-base-content/40">
                      {new Date(job.created_at).toLocaleDateString()}
                    </p>
                    {job.published_url && (
                      <p className="mt-0.5 text-xs text-success">
                        Live
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GenerateButton({
  label,
  icon,
  siteId,
  source,
}: {
  label: string;
  icon: React.ReactNode;
  siteId: string;
  source: string;
}) {
  const action = source === "research" ? generateFromResearch : generateFromScoring;
  return (
    <form action={action}>
      <input type="hidden" name="site_id" value={siteId} />
      <button type="submit" className="btn btn-outline btn-sm gap-2">
        {icon}
        {label}
      </button>
    </form>
  );
}
