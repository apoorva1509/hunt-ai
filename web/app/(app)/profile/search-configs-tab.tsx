"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  MapPin,
  Globe2,
  Filter,
  ChevronRight,
} from "lucide-react";
import type { ProfileSummary, ProfileDetail } from "./types";
import { SOURCE_NAMES } from "./types";
import { ProfileDetailView } from "./profile-detail";

export function SearchConfigsTab() {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProfileDetail | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/search-profile");
      if (!res.ok) return;
      const data = await res.json();
      setProfiles(data.profiles ?? []);
      setActive(data.active);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (slug: string) => {
    const res = await fetch(`/api/search-profile?slug=${slug}`);
    if (!res.ok) return;
    const data = await res.json();
    setDetail(data);
  };

  const switchProfile = async (slug: string) => {
    setSwitching(true);
    try {
      const res = await fetch("/api/search-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: slug }),
      });
      if (res.ok) {
        setActive(slug);
        setProfiles((prev) =>
          prev.map((p) => ({ ...p, active: p.slug === slug }))
        );
      }
    } finally {
      setSwitching(false);
    }
  };

  const deleteProfile = async (slug: string) => {
    if (!confirm(`Delete "${slug}"? This cannot be undone.`)) return;
    const res = await fetch("/api/search-profile", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (res.ok) load();
    else {
      const data = await res.json();
      alert(data.error);
    }
  };

  if (detail) {
    return (
      <ProfileDetailView
        profile={detail}
        onBack={() => {
          setDetail(null);
          load();
        }}
        onRefresh={load}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          The active config determines which sources and keywords the scanner uses.
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <Plus className="h-4 w-4" />
          New Config
        </button>
      </div>

      {showCreate && (
        <CreateProfileCard
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
          onCancel={() => setShowCreate(false)}
          existingSlugs={profiles.map((p) => p.slug)}
        />
      )}

      <div className="space-y-3">
        {profiles.map((p) => (
          <div
            key={p.slug}
            className={`group rounded-lg border bg-white transition-colors dark:bg-zinc-950 ${
              p.slug === active
                ? "border-green-300 border-l-4 border-l-green-500 dark:border-green-800 dark:border-l-green-500"
                : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
            }`}
          >
            <button
              onClick={() => openDetail(p.slug)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-medium">{p.slug}</h3>
                  {p.slug === active && (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      Active
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-4 text-sm text-zinc-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {p.location || "Not set"}
                    {p.remote && " (remote)"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe2 className="h-3.5 w-3.5" />
                    {p.enabledSources}/{p.totalSources} sources
                  </span>
                  <span className="flex items-center gap-1">
                    <Filter className="h-3.5 w-3.5" />
                    {p.keywordCount} keywords
                  </span>
                </div>

                {p.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.sources.map((src) => (
                      <span
                        key={src}
                        className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      >
                        {SOURCE_NAMES[src]}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500" />
            </button>

            <div className="flex items-center gap-2 border-t border-zinc-100 px-5 py-2 dark:border-zinc-800/50">
              {p.slug !== active && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      switchProfile(p.slug);
                    }}
                    disabled={switching}
                    className="rounded bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:bg-green-950 dark:text-green-400"
                  >
                    Set Active
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProfile(p.slug);
                    }}
                    className="rounded p-1 text-zinc-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              {p.slug === active && (
                <span className="text-xs text-zinc-400">
                  Currently active — pipeline runs use this config
                </span>
              )}
            </div>
          </div>
        ))}

        {profiles.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-500">
            No search configs found. Create one to get started.
          </p>
        )}
      </div>
    </div>
  );
}

function CreateProfileCard({
  onCreated,
  onCancel,
  existingSlugs,
}: {
  onCreated: () => void;
  onCancel: () => void;
  existingSlugs: string[];
}) {
  const [slug, setSlug] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    setError("");
    const normalized = slug
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    if (!normalized) {
      setError("Name is required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/search-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: normalized, copyFrom: copyFrom || undefined }),
      });

      if (res.ok) {
        onCreated();
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-3 font-medium">New Search Config</h3>
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            Name (lowercase, hyphens only)
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. remote-ai-startups"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            Copy from (optional)
          </label>
          <select
            value={copyFrom}
            onChange={(e) => setCopyFrom(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Start from scratch</option>
            {existingSlugs.map((s) => (
              <option key={s} value={s}>
                Copy from: {s}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
          </button>
          <button
            onClick={onCancel}
            className="rounded bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
