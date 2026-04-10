"use client";

import { useState, useEffect } from "react";
import { User, Search } from "lucide-react";
import type { CandidateData } from "./types";
import { SearchConfigsTab } from "./search-configs-tab";

type Tab = "profile" | "search-configs";

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>("search-configs");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setTab("profile")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "profile"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
            } rounded-l-lg`}
          >
            <User className="h-4 w-4" />
            My Profile
          </button>
          <button
            onClick={() => setTab("search-configs")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "search-configs"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
            } rounded-r-lg`}
          >
            <Search className="h-4 w-4" />
            Search Configs
          </button>
        </div>
      </div>

      {tab === "profile" && <CandidateProfileTab />}
      {tab === "search-configs" && <SearchConfigsTab />}
    </div>
  );
}

function CandidateProfileTab() {
  const [data, setData] = useState<CandidateData | null>(null);

  useEffect(() => {
    fetch("/api/candidate-profile")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return <p className="text-sm text-zinc-500">Loading profile...</p>;
  }

  return (
    <div className="space-y-6">
      <InfoCard title="Candidate" fields={data.candidate} />
      <InfoCard title="Compensation" fields={data.compensation} />
      <InfoCard title="Location" fields={data.location} />
      <InfoCard title="Narrative" fields={data.narrative} />

      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-lg font-medium">Target Roles</h2>
        <pre className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
          {data.target_roles || "—"}
        </pre>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-lg font-medium">Resume (cv.md)</h2>
        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
          {data.cv || "—"}
        </pre>
      </div>
    </div>
  );
}

function InfoCard({
  title,
  fields,
}: {
  title: string;
  fields: Record<string, string>;
}) {
  const entries = Object.entries(fields).filter(([, v]) => v);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-3 text-lg font-medium">{title}</h2>
      <div className="grid grid-cols-2 gap-4 text-sm">
        {entries.map(([key, val]) => (
          <div key={key}>
            <p className="font-medium text-zinc-500">
              {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </p>
            <p>{val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
