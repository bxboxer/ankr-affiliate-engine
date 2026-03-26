export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  RiArrowLeftLine,
  RiExternalLinkLine,
  RiGithubLine,
  RiCheckLine,
  RiCloseLine,
  RiFileTextLine,
  RiEditLine,
  RiExpandUpDownLine,
  RiPriceTagLine,
} from "react-icons/ri";
import { approveJob, rejectJob } from "./actions";

async function getContentJob(id: string) {
  try {
    const job = await db
      .selectFrom("content_jobs")
      .innerJoin("sites", "sites.id", "content_jobs.site_id")
      .select([
        "content_jobs.id",
        "content_jobs.title",
        "content_jobs.slug",
        "content_jobs.job_type",
        "content_jobs.source",
        "content_jobs.source_id",
        "content_jobs.status",
        "content_jobs.brief",
        "content_jobs.generated_content",
        "content_jobs.word_count",
        "content_jobs.target_keywords",
        "content_jobs.published_url",
        "content_jobs.commit_sha",
        "content_jobs.error_message",
        "content_jobs.created_at",
        "content_jobs.updated_at",
        "content_jobs.published_at",
        "sites.name as site_name",
        "sites.domain as site_domain",
        "sites.repo_name as site_repo",
      ])
      .where("content_jobs.id", "=", id)
      .executeTakeFirst();

    return job ?? null;
  } catch {
    return null;
  }
}

const JOB_TYPE_ICON: Record<string, React.ReactNode> = {
  new_article: <RiFileTextLine className="h-5 w-5" />,
  update: <RiEditLine className="h-5 w-5" />,
  expand: <RiExpandUpDownLine className="h-5 w-5" />,
  rewrite_meta: <RiPriceTagLine className="h-5 w-5" />,
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

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getContentJob(id);

  if (!job) notFound();

  const keywords = job.target_keywords as string[] | null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/content" className="btn btn-ghost btn-sm btn-circle">
          <RiArrowLeftLine className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="text-base-content/50">
              {JOB_TYPE_ICON[job.job_type]}
            </span>
            <h1 className="truncate text-2xl font-bold">{job.title}</h1>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-base-content/60">
            <span>{job.site_name}</span>
            <span className="text-base-content/30">|</span>
            <span>{JOB_TYPE_LABEL[job.job_type]}</span>
            <span className="text-base-content/30">|</span>
            <span className="capitalize">{job.source}</span>
          </div>
        </div>
        <span className={`badge gap-1 ${STATUS_BADGE[job.status]}`}>
          {job.status}
        </span>
      </div>

      {/* Metadata Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card bg-base-100">
          <div className="card-body p-4">
            <p className="text-sm text-base-content/60">Words</p>
            <p className="text-2xl font-bold">
              {job.word_count?.toLocaleString() ?? "—"}
            </p>
          </div>
        </div>
        <div className="card bg-base-100">
          <div className="card-body p-4">
            <p className="text-sm text-base-content/60">Created</p>
            <p className="font-semibold">
              {new Date(job.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="card bg-base-100">
          <div className="card-body p-4">
            <p className="text-sm text-base-content/60">Published</p>
            <p className="font-semibold">
              {job.published_at
                ? new Date(job.published_at).toLocaleDateString()
                : "Not yet"}
            </p>
          </div>
        </div>
      </div>

      {/* Keywords */}
      {keywords && keywords.length > 0 && (
        <div className="card bg-base-100">
          <div className="card-body p-4">
            <h2 className="text-sm font-semibold text-base-content/60">
              Target Keywords
            </h2>
            <div className="flex flex-wrap gap-2">
              {keywords.map((kw, i) => (
                <span key={i} className="badge badge-outline">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Brief */}
      {job.brief && (
        <div className="card bg-base-100">
          <div className="card-body p-4">
            <h2 className="text-sm font-semibold text-base-content/60">
              Brief
            </h2>
            <pre className="whitespace-pre-wrap text-sm">{job.brief}</pre>
          </div>
        </div>
      )}

      {/* Error */}
      {job.error_message && (
        <div className="alert alert-error">
          <RiCloseLine className="h-5 w-5" />
          <div>
            <h3 className="font-bold">Generation Failed</h3>
            <div className="text-sm">{job.error_message}</div>
          </div>
        </div>
      )}

      {/* Generated Content */}
      {job.generated_content && (
        <div className="card bg-base-100">
          <div className="card-body p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-base-content/60">
                Generated Content
              </h2>
              {job.status === "review" && (
                <div className="flex gap-2">
                  <PublishButton jobId={job.id} />
                  <RejectButton jobId={job.id} />
                </div>
              )}
            </div>
            <div className="prose prose-sm mt-3 max-w-none">
              <pre className="max-h-[600px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-base-200 p-4 text-sm">
                {job.generated_content}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Published Links */}
      {job.status === "published" && (
        <div className="card bg-base-100">
          <div className="card-body p-4">
            <h2 className="text-sm font-semibold text-base-content/60">
              Published
            </h2>
            <div className="flex gap-3">
              {job.published_url && (
                <a
                  href={job.published_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm gap-2"
                >
                  <RiExternalLinkLine className="h-4 w-4" />
                  View Live
                </a>
              )}
              {job.commit_sha && (
                <a
                  href={`https://github.com/bxboxer/${job.site_repo}/commit/${job.commit_sha}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm gap-2"
                >
                  <RiGithubLine className="h-4 w-4" />
                  Commit {job.commit_sha.slice(0, 7)}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PublishButton({ jobId }: { jobId: string }) {
  return (
    <form action={approveJob}>
      <input type="hidden" name="jobId" value={jobId} />
      <button className="btn btn-success btn-sm gap-1">
        <RiCheckLine className="h-4 w-4" />
        Approve & Publish
      </button>
    </form>
  );
}

function RejectButton({ jobId }: { jobId: string }) {
  return (
    <form action={rejectJob}>
      <input type="hidden" name="jobId" value={jobId} />
      <button className="btn btn-error btn-outline btn-sm gap-1">
        <RiCloseLine className="h-4 w-4" />
        Reject
      </button>
    </form>
  );
}
