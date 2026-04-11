"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";
import { useTrackerUrls } from "@/hooks/use-tracker";
import { TrackerCard } from "./tracker-card";
import { Plus, Link2 } from "lucide-react";

type StatusFilter = "all" | "pending" | "evaluated" | "failed" | "skipped";

const TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "evaluated", label: "Evaluated" },
  { key: "failed", label: "Failed" },
  { key: "skipped", label: "Skipped" },
];

export default function TrackerPage() {
  const { activeAgent } = useAgent();
  const items = useTrackerUrls();
  const addUrls = useMutation(api.trackerUrls.addUrls);
  const [showAdd, setShowAdd] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<StatusFilter>("all");

  if (!activeAgent) {
    return <p className="text-zinc-500">Select an agent first.</p>;
  }

  if (items === undefined) {
    return <p className="text-zinc-500">Loading tracker...</p>;
  }

  const filtered =
    tab === "all" ? items : items.filter((i: any) => i.status === tab);

  const counts: Record<string, number> = { all: items.length };
  for (const item of items as any[]) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }

  const handleAdd = async () => {
    if (!urlInput.trim()) return;
    setAdding(true);
    try {
      const urls = urlInput
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);
      await addUrls({
        agentId: activeAgent._id,
        urls,
        notes: notesInput.trim() || undefined,
      });
      setUrlInput("");
      setNotesInput("");
      setShowAdd(false);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          URL Tracker ({items.length})
        </h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <Plus className="h-4 w-4" />
          Add URLs
        </button>
      </div>

      {/* Add URLs form */}
      {showAdd && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-4 w-4 text-zinc-500" />
            <h3 className="font-medium">Add Job URLs</h3>
          </div>
          <p className="mb-3 text-sm text-zinc-500">
            Paste one or more job posting URLs (one per line). They&apos;ll be
            queued for evaluation.
          </p>
          <textarea
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={"https://jobs.example.com/posting/123\nhttps://boards.greenhouse.io/company/jobs/456"}
            rows={4}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-900"
            autoFocus
          />
          <div className="mt-2">
            <input
              type="text"
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleAdd}
              disabled={adding || !urlInput.trim()}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {adding ? "Adding..." : "Add to Tracker"}
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setUrlInput("");
                setNotesInput("");
              }}
              className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {label}
            {counts[key] !== undefined && (
              <span className="ml-1.5 text-xs text-zinc-400">
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <Link2 className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-3 text-sm text-zinc-500">
            {tab === "all"
              ? 'No tracked URLs yet. Click "Add URLs" to get started.'
              : `No ${tab} URLs.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item: any) => (
            <TrackerCard key={item._id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
