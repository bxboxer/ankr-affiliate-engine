"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [triggerResult, setTriggerResult] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function triggerOrchestrator(run: string) {
    setLoading(run);
    setTriggerResult(null);

    const res = await fetch("/api/orchestrator/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run }),
    });

    const data = await res.json();
    setTriggerResult(
      res.ok ? `Triggered ${run} successfully` : `Error: ${data.error}`
    );
    setLoading(null);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      {/* Manual Orchestrator Triggers */}
      <div className="card bg-base-100">
        <div className="card-body">
          <h2 className="card-title text-lg">Orchestrator Controls</h2>
          <p className="text-sm text-base-content/60">
            Manually trigger orchestrator runs. These also run automatically on
            a weekly cron via GitHub Actions.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { key: "all", label: "Full Run", desc: "Spawn + Score + Research + Recon" },
              { key: "spawn", label: "Spawn Only", desc: "Process queue" },
              { key: "score", label: "Score Only", desc: "Content scoring" },
              { key: "research", label: "Research Only", desc: "Niche research" },
              { key: "recon", label: "Recon Only", desc: "Intel gathering" },
              { key: "write", label: "Write Content", desc: "Generate queued articles" },
              { key: "pipeline", label: "Full Pipeline", desc: "Research → Score → Write" },
            ].map((action) => (
              <button
                key={action.key}
                className="btn btn-outline btn-sm justify-start gap-2"
                onClick={() => triggerOrchestrator(action.key)}
                disabled={loading !== null}
              >
                {loading === action.key ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : null}
                <div className="text-left">
                  <div className="text-sm font-medium">{action.label}</div>
                  <div className="text-xs opacity-60">{action.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {triggerResult && (
            <div className="alert mt-4 text-sm">{triggerResult}</div>
          )}
        </div>
      </div>

      {/* Environment Status */}
      <div className="card bg-base-100">
        <div className="card-body">
          <h2 className="card-title text-lg">Integration Status</h2>
          <div className="space-y-2 text-sm">
            <EnvCheck label="GitHub Token" envKey="GITHUB_TOKEN" />
            <EnvCheck label="Vercel Token" envKey="VERCEL_TOKEN" />
            <EnvCheck label="Anthropic API Key" envKey="ANTHROPIC_API_KEY" />
            <EnvCheck label="Database" envKey="POSTGRES_URL" />
            <EnvCheck label="Google Ads API" envKey="GOOGLE_ADS_DEVELOPER_TOKEN" />
            <EnvCheck label="Google GSC OAuth" envKey="GOOGLE_GSC_CLIENT_ID" />
            <EnvCheck label="GSC Service Account" envKey="GSC_SERVICE_ACCOUNT_B64" />
          </div>
        </div>
      </div>

      {/* Config Info */}
      <div className="card bg-base-100">
        <div className="card-body">
          <h2 className="card-title text-lg">Deploy Config</h2>
          <div className="space-y-1 text-sm text-base-content/70">
            <p>
              <span className="font-medium text-base-content">GitHub:</span>{" "}
              bxboxer (affiliate sites)
            </p>
            <p>
              <span className="font-medium text-base-content">Vercel:</span>{" "}
              blaine-personal account
            </p>
            <p>
              <span className="font-medium text-base-content">Template:</span>{" "}
              ankr-affiliate-template
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EnvCheck({ label, envKey }: { label: string; envKey: string }) {
  // In a real app, you'd check this server-side. For now, just show the label.
  return (
    <div className="flex items-center justify-between rounded-lg bg-base-200 p-2">
      <span>{label}</span>
      <span className="badge badge-ghost badge-xs">{envKey}</span>
    </div>
  );
}
