export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { db } from "@/lib/db";
import { triggerRecon } from "./actions";
import { TriggerToast } from "@/components/TriggerToast";

async function getDigests() {
  try {
    return await db
      .selectFrom("recon_digests")
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(10)
      .execute();
  } catch {
    return [];
  }
}

export default async function ReconPage() {
  const digests = await getDigests();

  return (
    <div className="space-y-6">
      <Suspense>
        <TriggerToast />
      </Suspense>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Recon Intelligence</h1>
          <p className="text-base-content/60">
            Weekly digests from SEO landscape monitoring, competitor analysis,
            and industry signal tracking.
          </p>
        </div>
        <form action={triggerRecon}>
          <button type="submit" className="btn btn-outline btn-sm">
            Run Recon Now
          </button>
        </form>
      </div>

      {digests.length === 0 ? (
        <div className="card bg-base-100">
          <div className="card-body items-center py-12 text-center">
            <h3 className="text-lg font-semibold">No recon digests yet</h3>
            <p className="text-base-content/60 max-w-md">
              The recon agent monitors Detailed, Ahrefs Blog, SEO Roundtable,
              and Reddit for signals. Run the orchestrator to generate your
              first digest.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {digests.map((digest) => {
            const data = digest.digest_data as {
              summary?: string;
              signals?: Array<{ source: string; headline: string; insight: string }>;
            } | null;
            const opportunities = digest.opportunities as Array<{
              type: string;
              description: string;
              priority: string;
            }> | null;

            return (
              <div key={digest.id} className="card bg-base-100">
                <div className="card-body">
                  <div className="flex items-start justify-between">
                    <h2 className="card-title text-lg">
                      Digest —{" "}
                      {new Date(digest.created_at).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </h2>
                    <div className="badge badge-ghost text-xs">
                      {(digest.sources_checked as string[])?.length ?? 0} sources
                    </div>
                  </div>

                  {data?.summary && (
                    <p className="text-sm text-base-content/80">
                      {data.summary}
                    </p>
                  )}

                  {data?.signals && data.signals.length > 0 && (
                    <div className="mt-2">
                      <h3 className="mb-2 text-sm font-semibold">
                        Key Signals
                      </h3>
                      <div className="space-y-2">
                        {data.signals.map((s, i) => (
                          <div
                            key={i}
                            className="rounded-lg bg-base-200 p-3 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span className="badge badge-xs badge-primary">
                                {s.source}
                              </span>
                              <span className="font-medium">{s.headline}</span>
                            </div>
                            <p className="mt-1 text-base-content/70">
                              {s.insight}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {opportunities && opportunities.length > 0 && (
                    <div className="mt-3">
                      <h3 className="mb-2 text-sm font-semibold">
                        Opportunities
                      </h3>
                      <div className="space-y-1">
                        {opportunities.map((opp, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span
                              className={`badge badge-xs ${
                                opp.priority === "high"
                                  ? "badge-error"
                                  : opp.priority === "medium"
                                    ? "badge-warning"
                                    : "badge-ghost"
                              }`}
                            >
                              {opp.priority}
                            </span>
                            <span className="badge badge-outline badge-xs">
                              {opp.type}
                            </span>
                            <span>{opp.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
