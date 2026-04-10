"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";
import { FileText, Plus, Trash2, ExternalLink } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

export default function ResumesPage() {
  const { activeAgent } = useAgent();
  const resumes = useQuery(
    api.resumeVariations.list,
    activeAgent ? { agentId: activeAgent._id } : "skip"
  );
  const upsert = useMutation(api.resumeVariations.upsert);
  const remove = useMutation(api.resumeVariations.remove);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    archetype: "",
    title: "",
    googleDocId: "",
    googleDocUrl: "",
  });

  if (!activeAgent) {
    return <p className="text-zinc-500">Select an agent first.</p>;
  }

  if (resumes === undefined) {
    return <p className="text-zinc-500">Loading resumes...</p>;
  }

  const handleCreate = async () => {
    if (!form.archetype || !form.title || !form.googleDocUrl) return;
    await upsert({
      agentId: activeAgent._id,
      archetype: form.archetype,
      title: form.title,
      googleDocId: form.googleDocId,
      googleDocUrl: form.googleDocUrl,
    });
    setForm({ archetype: "", title: "", googleDocId: "", googleDocUrl: "" });
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Resume Variations ({resumes.length})
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <Plus className="h-4 w-4" />
          Add Variation
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Archetype
              </label>
              <input
                type="text"
                value={form.archetype}
                onChange={(e) =>
                  setForm({ ...form, archetype: e.target.value })
                }
                placeholder="e.g., ai_platform_llmops"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., AI Platform Engineer CV"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Google Doc URL
              </label>
              <input
                type="text"
                value={form.googleDocUrl}
                onChange={(e) =>
                  setForm({ ...form, googleDocUrl: e.target.value })
                }
                placeholder="https://docs.google.com/..."
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Google Doc ID
              </label>
              <input
                type="text"
                value={form.googleDocId}
                onChange={(e) =>
                  setForm({ ...form, googleDocId: e.target.value })
                }
                placeholder="doc-id"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreate}
              className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Resume grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resumes.length === 0 ? (
          <p className="col-span-full text-sm text-zinc-500">
            No resume variations yet. Add one or run the pipeline to auto-generate.
          </p>
        ) : (
          resumes.map((r: any) => (
            <div
              key={r._id}
              className="flex flex-col rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-zinc-400" />
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-zinc-500">{r.archetype}</p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    remove({ id: r._id as Id<"resumeVariations"> })
                  }
                  className="text-zinc-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <a
                  href={r.googleDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open in Google Docs
                </a>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                Last synced:{" "}
                {new Date(r.lastSyncedAt).toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
