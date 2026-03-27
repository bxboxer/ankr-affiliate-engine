"use server";

import { redirect } from "next/navigation";
import { triggerOrchestrator } from "@/lib/trigger-orchestrator";

export async function triggerRecon() {
  const result = await triggerOrchestrator("recon");

  if (!result.ok) {
    redirect("/recon?error=trigger_failed");
  }

  redirect("/recon?triggered=recon");
}
