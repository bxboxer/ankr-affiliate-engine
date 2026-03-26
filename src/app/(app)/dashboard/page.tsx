export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { sql } from "kysely";
import Link from "next/link";
import {
  RiGlobalLine,
  RiArrowRightUpLine,
  RiSpyLine,
  RiLightbulbLine,
  RiAddCircleLine,
} from "react-icons/ri";

async function getStats() {
  try {
    const sites = await db
      .selectFrom("sites")
      .select([
        sql<number>`count(*)`.as("total"),
        sql<number>`count(*) filter (where status = 'active')`.as("active"),
        sql<number>`coalesce(sum(monthly_traffic), 0)`.as("totalTraffic"),
        sql<number>`coalesce(sum(monthly_revenue), 0)`.as("totalRevenue"),
      ])
      .executeTakeFirst();

    const recentReports = await db
      .selectFrom("scoring_reports")
      .innerJoin("sites", "sites.id", "scoring_reports.site_id")
      .select([
        "scoring_reports.id",
        "sites.name as siteName",
        "sites.domain",
        "scoring_reports.total_pages",
        "scoring_reports.pages_to_prune",
        "scoring_reports.pages_to_update",
        "scoring_reports.created_at",
      ])
      .orderBy("scoring_reports.created_at", "desc")
      .limit(5)
      .execute();

    const queueCount = await db
      .selectFrom("spawn_queue")
      .where("status", "=", "queued")
      .select(sql<number>`count(*)`.as("count"))
      .executeTakeFirst();

    const researchCount = await db
      .selectFrom("niche_research")
      .where("status", "=", "complete")
      .select(sql<number>`count(*)`.as("count"))
      .executeTakeFirst();

    return {
      total: Number(sites?.total ?? 0),
      active: Number(sites?.active ?? 0),
      totalTraffic: Number(sites?.totalTraffic ?? 0),
      totalRevenue: Number(sites?.totalRevenue ?? 0),
      recentReports,
      queuedSpawns: Number(queueCount?.count ?? 0),
      researchCount: Number(researchCount?.count ?? 0),
    };
  } catch {
    // DB not connected yet — return empty state
    return {
      total: 0,
      active: 0,
      totalTraffic: 0,
      totalRevenue: 0,
      recentReports: [],
      queuedSpawns: 0,
      researchCount: 0,
    };
  }
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Link href="/spawn" className="btn btn-primary btn-sm gap-2">
          <RiAddCircleLine className="h-4 w-4" />
          Spawn Site
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Sites"
          value={stats.total}
          icon={<RiGlobalLine className="h-6 w-6" />}
          color="primary"
        />
        <StatCard
          label="Active Sites"
          value={stats.active}
          icon={<RiArrowRightUpLine className="h-6 w-6" />}
          color="success"
        />
        <StatCard
          label="Monthly Traffic"
          value={stats.totalTraffic.toLocaleString()}
          icon={<RiArrowRightUpLine className="h-6 w-6" />}
          color="info"
        />
        <StatCard
          label="Est. Revenue"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          icon={<RiArrowRightUpLine className="h-6 w-6" />}
          color="warning"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Recent Scoring Reports */}
        <div className="card bg-base-100">
          <div className="card-body">
            <h2 className="card-title text-lg">Recent Scoring Reports</h2>
            {stats.recentReports.length === 0 ? (
              <p className="text-base-content/50 py-4 text-center text-sm">
                No scoring reports yet. Run the orchestrator to generate reports.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Site</th>
                      <th>Pages</th>
                      <th>Prune</th>
                      <th>Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentReports.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium">{r.siteName}</td>
                        <td>{r.total_pages}</td>
                        <td className="text-error">{r.pages_to_prune}</td>
                        <td className="text-warning">{r.pages_to_update}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Quick Status */}
        <div className="card bg-base-100">
          <div className="card-body">
            <h2 className="card-title text-lg">Network Status</h2>
            <div className="space-y-3 py-2">
              <StatusRow
                label="Sites in spawn queue"
                value={stats.queuedSpawns}
                href="/spawn"
              />
              <StatusRow
                label="Niche opportunities"
                value={stats.researchCount}
                href="/research"
                icon={<RiLightbulbLine className="h-4 w-4" />}
              />
              <StatusRow
                label="Recon digests"
                value="View latest"
                href="/recon"
                icon={<RiSpyLine className="h-4 w-4" />}
              />
              <div className="divider my-1" />
              <p className="text-xs text-base-content/50">
                Orchestrator runs automatically via GitHub Actions every Monday
                at 6 AM UTC, or trigger manually from Settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="card bg-base-100">
      <div className="card-body flex-row items-center gap-4 p-4">
        <div className={`rounded-lg bg-${color}/10 p-3 text-${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-base-content/60">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  href,
  icon,
}: {
  label: string;
  value: string | number;
  href: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-base-200"
    >
      <span className="flex items-center gap-2 text-sm">
        {icon}
        {label}
      </span>
      <span className="badge badge-ghost badge-sm">{value}</span>
    </Link>
  );
}
