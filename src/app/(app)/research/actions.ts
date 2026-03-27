"use server";

import { redirect } from "next/navigation";
import { triggerOrchestrator } from "@/lib/trigger-orchestrator";

export async function triggerResearch() {
  const result = await triggerOrchestrator("research");

  if (!result.ok) {
    redirect("/research?error=trigger_failed");
  }

  redirect("/research?triggered=research");
}
