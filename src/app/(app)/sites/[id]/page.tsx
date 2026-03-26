import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { RiArrowLeftLine, RiExternalLinkLine, RiGithubLine } from "react-icons/ri";

async function getSiteWithReports(id: string) {
  try {
    const site = await db
      .selectFrom("sites")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!site) return null;

    const reports = await db
      .selectFrom("scoring_reports")
      .selectAll()
      .where("site_id", "=", id)
      .orderBy("created_at", "desc")
      .limit(10)
      .execute();

    return { site, reports };
  } catch {
    return null;
  }
}

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSiteWithReports(id);

  if (!data) notFound();
  const { site, reports } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sites" className="btn btn-ghost btn-sm btn-circle">
          <RiArrowLeftLine className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{site.name}</h1>
          <p className="text-base-content/60">{site.domain}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <a
            href={`https://${site.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm gap-2"
          >
            <RiExternalLinkLine className="h-4 w-4" />
            Visit
          </a>
          <a
            href={`https://github.com/${process.env.GITHUB_OWNER ?? "bxboxer"}/${site.repo_name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm gap-2"
          >
            <RiGithubLine className="h-4 w-4" />
            Repo
          </a>
        </div>
      </div>

      {/* Site Info Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card bg-base-100">
          <div className="card-body p-4">
            <p className="text-sm text-base-content/60">Niche</p>
            <p className="font-semibold">{site.niche}</p>
          </div>
        </div>
        <div className="card bg-base-100">
          <div className="card-body p-4">
            <p className="text-sm text-base-content/60">Affiliate</p>
            <p className="font-semibold">
              {site.affiliate_program} — {site.affiliate_tag ?? "No tag"}
            </p>
          </div>
        </div>
        <div className="card bg-base-100">
          <div className="card-body p-4">
            <p className="text-sm text-base-content/60">Status</p>
            <p className="font-semibold capitalize">{site.status}</p>
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card bg-base-100">
          <div className="card-body p-4">
            <p className="text-sm text-base-content/60">Monthly Traffic</p>
            <p className="text-3xl font-bold">
              {site.monthly_traffic?.toLocaleString() ?? "—"}
            </p>
          </div>
        </div>
        <div className="card bg-base-100">
          <div className="card-body p-4">
            <p className="text-sm text-base-content/60">Monthly Revenue</p>
            <p className="text-3xl font-bold">
              {site.monthly_revenue
                ? `$${site.monthly_revenue.toLocaleString()}`
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Scoring Reports */}
      <div className="card bg-base-100">
        <div className="card-body">
          <h2 className="card-title text-lg">Scoring Reports</h2>
          {reports.length === 0 ? (
            <p className="py-4 text-center text-sm text-base-content/50">
              No scoring reports yet. Run the orchestrator to generate one.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Total Pages</th>
                    <th>Prune</th>
                    <th>Update</th>
                    <th>Expand</th>
                    <th>Rewrite Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td>{r.total_pages}</td>
                      <td className="text-error">{r.pages_to_prune}</td>
                      <td className="text-warning">{r.pages_to_update}</td>
                      <td className="text-info">{r.pages_to_expand}</td>
                      <td className="text-secondary">
                        {r.pages_to_rewrite_meta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Keywords */}
      {site.target_keywords && (
        <div className="card bg-base-100">
          <div className="card-body">
            <h2 className="card-title text-lg">Target Keywords</h2>
            <div className="flex flex-wrap gap-2">
              {(site.target_keywords as string[]).map((kw) => (
                <span key={kw} className="badge badge-outline">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
