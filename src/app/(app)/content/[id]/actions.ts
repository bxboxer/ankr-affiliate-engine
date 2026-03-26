"use server";

import { db } from "@/lib/db";
import { sql } from "kysely";
import { redirect } from "next/navigation";

export async function approveJob(formData: FormData) {
  const jobId = formData.get("jobId") as string;

  await db
    .updateTable("content_jobs")
    .set({ status: "queued", updated_at: sql`now()` })
    .where("id", "=", jobId)
    .execute();

  redirect(`/content/${jobId}`);
}

export async function rejectJob(formData: FormData) {
  const jobId = formData.get("jobId") as string;

  await db
    .updateTable("content_jobs")
    .set({
      status: "failed",
      error_message: "Rejected by admin",
      updated_at: sql`now()`,
    })
    .where("id", "=", jobId)
    .execute();

  redirect(`/content/${jobId}`);
}
