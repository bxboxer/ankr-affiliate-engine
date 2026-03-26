"use client";

import { useSearchParams } from "next/navigation";
import { RiCheckLine, RiErrorWarningLine } from "react-icons/ri";

const LABELS: Record<string, string> = {
  research: "Research",
  recon: "Recon",
  score: "Scoring",
  spawn: "Spawn",
  write: "Content Writer",
  pipeline: "Pipeline",
  all: "Full Run",
};

export function TriggerToast() {
  const params = useSearchParams();
  const triggered = params.get("triggered");
  const error = params.get("error");

  if (!triggered && !error) return null;

  if (error) {
    return (
      <div className="alert alert-error mb-4">
        <RiErrorWarningLine className="h-5 w-5" />
        <span>Failed to trigger orchestrator. Check Settings for configuration.</span>
      </div>
    );
  }

  const label = LABELS[triggered!] ?? triggered;

  return (
    <div className="alert alert-success mb-4">
      <RiCheckLine className="h-5 w-5" />
      <span>
        {label} triggered successfully. The orchestrator is running via GitHub
        Actions — results will appear here once complete.
      </span>
    </div>
  );
}
