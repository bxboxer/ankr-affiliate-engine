"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiSearchLine, RiCheckLine, RiEditLine } from "react-icons/ri";

interface DetectedSite {
  domain: string;
  name: string;
  niche: string;
  repo_name: string;
  affiliate_program: string;
  affiliate_tag: string;
  description: string;
  detected: {
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
    htmlLength: number;
    fetchError: string | null;
  };
}

export default function AddSitePage() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detected, setDetected] = useState<DetectedSite | null>(null);
  const [editing, setEditing] = useState(false);

  // Editable overrides
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [repoName, setRepoName] = useState("");
  const [affiliateTag, setAffiliateTag] = useState("");
  const [affiliateProgram, setAffiliateProgram] = useState("amazon");

  async function handleDetect(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;

    setDetecting(true);
    setError("");
    setDetected(null);

    try {
      const res = await fetch("/api/sites/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Detection failed");
        setDetecting(false);
        return;
      }

      const data: DetectedSite = await res.json();
      setDetected(data);
      setName(data.name);
      setNiche(data.niche);
      setRepoName(data.repo_name);
      setAffiliateTag(data.affiliate_tag);
      setAffiliateProgram(data.affiliate_program);
    } catch {
      setError("Failed to detect site info");
    }
    setDetecting(false);
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        domain: detected!.domain,
        niche,
        repo_name: repoName,
        affiliate_program: affiliateProgram,
        affiliate_tag: affiliateTag || null,
        status: "active",
      }),
    });

    if (res.ok) {
      router.push("/sites");
    } else {
      const err = await res.json();
      setError(err.error ?? "Failed to add site");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Add Site</h1>
      <p className="text-base-content/60">
        Enter a domain and we&apos;ll auto-detect everything else.
      </p>

      {/* Step 1: Domain input */}
      <form onSubmit={handleDetect} className="card bg-base-100">
        <div className="card-body">
          <div className="flex gap-3">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="bestgamingbuys.com"
              className="input input-bordered flex-1"
              disabled={detecting}
              autoFocus
            />
            <button
              type="submit"
              className="btn btn-primary gap-2"
              disabled={detecting || !domain.trim()}
            >
              {detecting ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <RiSearchLine className="h-4 w-4" />
              )}
              Detect
            </button>
          </div>
        </div>
      </form>

      {error && <div className="alert alert-error text-sm">{error}</div>}

      {/* Step 2: Review detected info */}
      {detected && (
        <div className="card bg-base-100">
          <div className="card-body space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="card-title text-lg">Detected Configuration</h2>
              <button
                className="btn btn-ghost btn-xs gap-1"
                onClick={() => setEditing(!editing)}
              >
                <RiEditLine className="h-3.5 w-3.5" />
                {editing ? "Done" : "Edit"}
              </button>
            </div>

            {detected.detected.fetchError && (
              <div className="alert alert-warning text-xs">
                Couldn&apos;t reach the site — using defaults from the domain
                name. You can edit below.
              </div>
            )}

            <div className="space-y-3">
              <DetectedField
                label="Site Name"
                value={name}
                editing={editing}
                onChange={setName}
              />
              <DetectedField
                label="Domain"
                value={detected.domain}
                editing={false}
              />
              <DetectedField
                label="Niche"
                value={niche}
                editing={editing}
                onChange={setNiche}
              />
              <DetectedField
                label="Repo Name"
                value={repoName}
                editing={editing}
                onChange={setRepoName}
                hint="Under bxboxer GitHub account"
              />
              {editing ? (
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs font-medium text-base-content/60">
                      Affiliate Program
                    </span>
                  </label>
                  <select
                    className="select select-bordered select-sm"
                    value={affiliateProgram}
                    onChange={(e) => setAffiliateProgram(e.target.value)}
                  >
                    <option value="amazon">Amazon Associates</option>
                    <option value="impact">Impact</option>
                    <option value="shareasale">ShareASale</option>
                    <option value="partnerstack">PartnerStack</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              ) : (
                <DetectedField
                  label="Affiliate Program"
                  value={affiliateProgram}
                  editing={false}
                />
              )}
              <DetectedField
                label="Affiliate Tag"
                value={affiliateTag}
                editing={editing}
                onChange={setAffiliateTag}
                placeholder="auto-detected or enter manually"
              />
            </div>

            {detected.description && (
              <div className="rounded-lg bg-base-200 p-3">
                <p className="text-xs font-medium text-base-content/50 mb-1">
                  Site Description
                </p>
                <p className="text-sm">{detected.description}</p>
              </div>
            )}

            <button
              className="btn btn-primary w-full gap-2"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <RiCheckLine className="h-4 w-4" />
              )}
              Add to Network
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetectedField({
  label,
  value,
  editing,
  onChange,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange?: (v: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label py-1">
        <span className="label-text text-xs font-medium text-base-content/60">
          {label}
        </span>
      </label>
      {editing && onChange ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input input-bordered input-sm w-full"
          placeholder={placeholder}
        />
      ) : (
        <p className="px-1 text-sm font-medium">{value || "—"}</p>
      )}
      {hint && <p className="text-xs text-base-content/40 mt-0.5">{hint}</p>}
    </div>
  );
}
