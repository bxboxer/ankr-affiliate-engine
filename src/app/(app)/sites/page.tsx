import { db } from "@/lib/db";
import Link from "next/link";
import { RiAddCircleLine, RiExternalLinkLine } from "react-icons/ri";

async function getSites() {
  try {
    return await db
      .selectFrom("sites")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();
  } catch {
    return [];
  }
}

const STATUS_BADGE: Record<string, string> = {
  active: "badge-success",
  spawning: "badge-info",
  paused: "badge-warning",
  archived: "badge-ghost",
};

export default async function SitesPage() {
  const sites = await getSites();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sites</h1>
        <Link href="/spawn" className="btn btn-primary btn-sm gap-2">
          <RiAddCircleLine className="h-4 w-4" />
          Spawn New
        </Link>
      </div>

      {sites.length === 0 ? (
        <div className="card bg-base-100">
          <div className="card-body items-center py-12 text-center">
            <h3 className="text-lg font-semibold">No sites yet</h3>
            <p className="text-base-content/60 max-w-md">
              Spawn your first site or add an existing one to start tracking
              performance across your affiliate network.
            </p>
            <div className="mt-4 flex gap-2">
              <Link href="/spawn" className="btn btn-primary btn-sm">
                Spawn a Site
              </Link>
              <Link href="/sites/add" className="btn btn-ghost btn-sm">
                Add Site
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-base-100">
          <table className="table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Niche</th>
                <th>Status</th>
                <th>Traffic</th>
                <th>Revenue</th>
                <th>Last Scored</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id} className="hover">
                  <td>
                    <div>
                      <div className="font-medium">{site.name}</div>
                      <div className="text-xs text-base-content/50">
                        {site.domain}
                      </div>
                    </div>
                  </td>
                  <td className="text-sm">{site.niche}</td>
                  <td>
                    <span
                      className={`badge badge-sm ${STATUS_BADGE[site.status] ?? "badge-ghost"}`}
                    >
                      {site.status}
                    </span>
                  </td>
                  <td className="text-sm">
                    {site.monthly_traffic?.toLocaleString() ?? "—"}
                  </td>
                  <td className="text-sm">
                    {site.monthly_revenue
                      ? `$${site.monthly_revenue.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="text-xs text-base-content/50">
                    {site.last_scored_at
                      ? new Date(site.last_scored_at).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Link
                        href={`/sites/${site.id}`}
                        className="btn btn-ghost btn-xs"
                      >
                        Details
                      </Link>
                      <a
                        href={`https://${site.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-xs"
                      >
                        <RiExternalLinkLine className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
