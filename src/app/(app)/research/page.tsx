export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  RiSearchLine,
  RiFireLine,
  RiBarChartLine,
  RiMoneyDollarCircleLine,
  RiArrowUpLine,
  RiChatSmileLine,
  RiShoppingCartLine,
} from "react-icons/ri";

async function getResearchData() {
  try {
    const niches = await db
      .selectFrom("niche_research")
      .selectAll()
      .where("status", "=", "complete")
      .orderBy("consensus_score", "desc")
      .limit(50)
      .execute();

    const categories = [...new Set(niches.map((n) => n.category))];

    return { niches, categories };
  } catch {
    return { niches: [], categories: [] };
  }
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-error";
  return <span className={`text-2xl font-bold ${color}`}>{score}</span>;
}

function MiniScore({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
}) {
  if (value === null || value === undefined) return null;
  const barWidth = Math.max(4, Math.min(100, value));
  const color =
    value >= 70
      ? "bg-success/30"
      : value >= 40
        ? "bg-warning/30"
        : "bg-error/30";

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-base-content/50">{icon}</span>
      <span className="w-16 text-base-content/70">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-base-300">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className="w-6 text-right text-base-content/60">{value}</span>
    </div>
  );
}

export default async function ResearchPage() {
  const { niches } = await getResearchData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Niche Research</h1>
          <p className="text-base-content/60">
            Consensus-scored niche opportunities from Keyword Planner, Amazon,
            Reddit, and Google Trends.
          </p>
        </div>
        <form action="/api/orchestrator/trigger" method="POST">
          <input type="hidden" name="run" value="research" />
          <button type="submit" className="btn btn-outline btn-sm gap-2">
            <RiSearchLine className="h-4 w-4" />
            Run Research
          </button>
        </form>
      </div>

      {niches.length === 0 ? (
        <div className="card bg-base-100">
          <div className="card-body items-center py-12 text-center">
            <h3 className="text-lg font-semibold">No research data yet</h3>
            <p className="text-base-content/60 max-w-md">
              The research agent gathers data from Google Keyword Planner,
              Amazon Best Sellers, Reddit, and Google Trends, then scores niches
              using Claude. Run the orchestrator to generate your first research
              report.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {niches.map((niche) => {
            const analysis = niche.claude_analysis as {
              reasoning?: string;
            } | null;
            const topKeywords = niche.top_keywords as string[] | null;
            const topProducts = niche.top_products as Array<{
              title: string;
              why: string;
            }> | null;
            const sources = niche.sources_used as string[] | null;

            return (
              <div key={niche.id} className="card bg-base-100">
                <div className="card-body gap-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="card-title text-base">
                        {niche.niche_name}
                      </h2>
                      <span className="badge badge-sm badge-primary mt-1">
                        {niche.category}
                      </span>
                    </div>
                    <div className="text-right">
                      <ScoreBadge score={niche.consensus_score} />
                      <p className="text-[10px] text-base-content/40">
                        consensus
                      </p>
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div className="space-y-1.5">
                    <MiniScore
                      label="Search"
                      value={niche.trending_score}
                      icon={<RiBarChartLine className="h-3 w-3" />}
                    />
                    <MiniScore
                      label="CPC"
                      value={
                        niche.avg_cpc
                          ? Math.min(100, Math.round(niche.avg_cpc / 5))
                          : null
                      }
                      icon={<RiMoneyDollarCircleLine className="h-3 w-3" />}
                    />
                    <MiniScore
                      label="Trend"
                      value={niche.trending_score}
                      icon={<RiArrowUpLine className="h-3 w-3" />}
                    />
                    <MiniScore
                      label="Reddit"
                      value={niche.reddit_buzz_score}
                      icon={<RiChatSmileLine className="h-3 w-3" />}
                    />
                    <MiniScore
                      label="Amazon"
                      value={niche.amazon_demand_score}
                      icon={<RiShoppingCartLine className="h-3 w-3" />}
                    />
                  </div>

                  {/* Key Metrics */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {niche.search_volume_avg && (
                      <span className="badge badge-ghost badge-sm">
                        {niche.search_volume_avg.toLocaleString()} vol/mo
                      </span>
                    )}
                    {niche.avg_cpc && (
                      <span className="badge badge-ghost badge-sm">
                        ${(niche.avg_cpc / 100).toFixed(2)} CPC
                      </span>
                    )}
                    {niche.competition_level && (
                      <span
                        className={`badge badge-sm ${
                          niche.competition_level === "LOW"
                            ? "badge-success"
                            : niche.competition_level === "MEDIUM"
                              ? "badge-warning"
                              : "badge-error"
                        }`}
                      >
                        {niche.competition_level} competition
                      </span>
                    )}
                  </div>

                  {/* Top Keywords */}
                  {topKeywords && topKeywords.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold text-base-content/60">
                        Top Keywords
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {topKeywords.slice(0, 5).map((kw, i) => (
                          <span
                            key={i}
                            className="badge badge-outline badge-xs"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Products */}
                  {topProducts && topProducts.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold text-base-content/60">
                        Top Products
                      </p>
                      <div className="space-y-1">
                        {topProducts.slice(0, 3).map((p, i) => (
                          <div
                            key={i}
                            className="rounded bg-base-200 px-2 py-1 text-xs"
                          >
                            <span className="font-medium">{p.title}</span>
                            {p.why && (
                              <span className="text-base-content/50">
                                {" "}
                                — {p.why}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Claude Analysis */}
                  {analysis?.reasoning && (
                    <p className="text-xs text-base-content/60 italic">
                      {analysis.reasoning}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between border-t border-base-300 pt-2">
                    <div className="flex gap-1">
                      {sources?.map((s, i) => (
                        <span
                          key={i}
                          className="badge badge-ghost badge-xs"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    <span className="text-[10px] text-base-content/40">
                      {new Date(niche.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
