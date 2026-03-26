"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddExistingSitePage() {
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
      repo_name: form.get("repo_name"),
      affiliate_program: form.get("affiliate_program"),
      affiliate_tag: form.get("affiliate_tag"),
      vercel_project_id: form.get("vercel_project_id") || null,
      status: "active",
    };

    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      router.push("/sites");
    } else {
      const err = await res.json();
      setError(err.error ?? "Failed to add site");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Add Existing Site</h1>
      <p className="text-base-content/60">
        Register an already-deployed site into your network for tracking and
        scoring.
      </p>

      <form onSubmit={handleSubmit} className="card bg-base-100">
        <div className="card-body space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Site Name</span>
              </label>
              <input
                name="name"
                type="text"
                placeholder="Prime Gaming Finds"
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
                placeholder="primegamingfinds.com"
                className="input input-bordered"
                required
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Niche</span>
            </label>
            <input
              name="niche"
              type="text"
              placeholder="Gaming Peripherals & Equipment"
              className="input input-bordered"
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">GitHub Repo Name</span>
            </label>
            <input
              name="repo_name"
              type="text"
              placeholder="prime-gaming-finds"
              className="input input-bordered"
              required
            />
            <label className="label">
              <span className="label-text-alt text-base-content/50">
                Under bxboxer GitHub account
              </span>
            </label>
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
                placeholder="bestgamingb04-20"
                className="input input-bordered"
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">
                Vercel Project ID (optional)
              </span>
            </label>
            <input
              name="vercel_project_id"
              type="text"
              placeholder="prj_xxxxxxxxxxxx"
              className="input input-bordered"
            />
          </div>

          {error && <div className="alert alert-error text-sm">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              "Add Site"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
