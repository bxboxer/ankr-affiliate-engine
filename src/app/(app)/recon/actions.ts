"use server";

import { redirect } from "next/navigation";

export async function triggerRecon() {
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/orchestrator/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run: "recon" }),
  });

  if (!res.ok) {
    redirect("/recon?error=trigger_failed");
  }

  redirect("/recon?triggered=recon");
}
