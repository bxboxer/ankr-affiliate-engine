"use server";

import { redirect } from "next/navigation";

export async function triggerResearch() {
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/orchestrator/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run: "research" }),
  });

  if (!res.ok) {
    redirect("/research?error=trigger_failed");
  }

  redirect("/research?triggered=research");
}
