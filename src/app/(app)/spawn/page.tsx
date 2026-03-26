"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiAddCircleLine } from "react-icons/ri";

export default function SpawnPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name"),
      domain: form.get("domain"),
      niche: form.get("niche"),
      audience_description: form.get("audience_description"),
      affiliate_program: form.get("affiliate_program"),
      affiliate_tag: form.get("affiliate_tag"),
      target_keywords: (form.get("target_keywords") as string)
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    };

    const res = await fetch("/api/spawn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      router.push("/sites");
    } else {
      const err = await res.json();
      setError(err.error ?? "Failed to queue site spawn");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Spawn New Site</h1>
      <p className="text-base-content/60">
        Queue a new affiliate site. The orchestrator will clone your template
        repo, generate a CLAUDE.md, create a Vercel project, and configure the
        domain.
      </p>

      <form onSubmit={handleSubmit} className="card bg-base-100">
        <div className="card-body space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Site Name</span>
            </label>
            <input
              name="name"
              type="text"
              placeholder="ARK Gear Guide"
              className="input input-bordered"
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Domain</span>
            </label>
            <input
              name="domain"
              type="text"
              placeholder="arkgearguide.com"
              className="input input-bordered"
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Niche</span>
            </label>
            <input
              name="niche"
              type="text"
              placeholder="Gaming gear for ARK Survival Ascended"
              className="input input-bordered"
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">
                Audience Description
              </span>
            </label>
            <textarea
              name="audience_description"
              className="textarea textarea-bordered"
              placeholder="PC gamers playing ARK ASA, research-heavy buyers for rigs and peripherals"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">
                  Affiliate Program
                </span>
              </label>
              <select
                name="affiliate_program"
                className="select select-bordered"
                defaultValue="amazon"
              >
                <option value="amazon">Amazon Associates</option>
                <option value="impact">Impact</option>
                <option value="shareasale">ShareASale</option>
                <option value="partnerstack">PartnerStack</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Affiliate Tag</span>
              </label>
              <input
                name="affiliate_tag"
                type="text"
                placeholder="arkgear-20"
                className="input input-bordered"
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">
                Target Keywords (comma-separated)
              </span>
            </label>
            <textarea
              name="target_keywords"
              className="textarea textarea-bordered"
              placeholder="best pc for ark survival ascended, ark asa settings guide, gaming chair for ark"
              rows={2}
            />
          </div>

          {error && (
            <div className="alert alert-error text-sm">{error}</div>
          )}

          <button
            type="submit"
            className="btn btn-primary gap-2"
            disabled={loading}
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <RiAddCircleLine className="h-4 w-4" />
            )}
            Queue Site Spawn
          </button>
        </div>
      </form>
    </div>
  );
}
