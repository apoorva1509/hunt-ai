"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";
import {
  FileText,
  Plus,
  Trash2,
  ExternalLink,
  Download,
  Eye,
  Building2,
  X,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

export default function ResumesPage() {
  const { activeAgent } = useAgent();
  const resumes = useQuery(
    api.resumeVariations.list,
    activeAgent ? { agentId: activeAgent._id } : "skip"
  );
  const companyResumes = useQuery(api.outreachCompanies.listWithResumes);
  const upsert = useMutation(api.resumeVariations.upsert);
  const remove = useMutation(api.resumeVariations.remove);
  const removeCompanyResume = useMutation(api.outreachCompanies.removeResume);

  const [showForm, setShowForm] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
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

  const totalCount =
    resumes.length + (companyResumes?.length ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Resume Variations ({totalCount})
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

      {/* Company-tailored resumes */}
      {companyResumes && companyResumes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-zinc-400" />
            Company-Tailored Resumes ({companyResumes.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companyResumes.map((cr: any) => (
              <div
                key={cr._id}
                className="flex flex-col rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    {cr.logoUrl ? (
                      <img
                        src={cr.logoUrl}
                        alt={cr.name}
                        className="h-8 w-8 rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800">
                        <Building2 className="h-4 w-4 text-zinc-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{cr.name}</p>
                      {cr.roleAppliedFor && (
                        <p className="text-xs text-zinc-500">
                          {cr.roleAppliedFor}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Remove resume for ${cr.name}?`))
                        removeCompanyResume({
                          id: cr._id as Id<"outreachCompanies">,
                        });
                    }}
                    className="text-zinc-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <p className="mt-2 text-xs text-zinc-400 truncate">
                  {cr.resumeFileName}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  {cr.resumeUrl && (
                    <>
                      <button
                        onClick={() => {
                          setPreviewUrl(cr.resumeUrl);
                          setPreviewTitle(
                            `${cr.name}${cr.roleAppliedFor ? ` — ${cr.roleAppliedFor}` : ""}`
                          );
                        }}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        <Eye className="h-3 w-3" />
                        Preview
                      </button>
                      <a
                        href={cr.resumeUrl}
                        download={cr.resumeFileName ?? "resume.pdf"}
                        className="flex items-center gap-1 text-sm text-zinc-500 hover:underline"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </a>
                    </>
                  )}
                </div>

                <p className="mt-2 text-xs text-zinc-400">
                  Uploaded:{" "}
                  {new Date(cr.updatedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Base resume variations (Google Docs) */}
      <div>
        {companyResumes && companyResumes.length > 0 && (
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-zinc-400" />
            Base Templates ({resumes.length})
          </h2>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resumes.length === 0 && (!companyResumes || companyResumes.length === 0) ? (
            <p className="col-span-full text-sm text-zinc-500">
              No resume variations yet. Add one or run the pipeline to
              auto-generate.
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

      {/* PDF Preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl h-[85vh] mx-4 rounded-xl bg-white shadow-2xl dark:bg-zinc-900 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-zinc-500" />
                <span className="text-sm font-medium">{previewTitle}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  download
                  className="flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  <Download className="h-3 w-3" />
                  Download
                </a>
                <button
                  onClick={() => {
                    setPreviewUrl(null);
                    setPreviewTitle("");
                  }}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={previewUrl}
                className="w-full h-full"
                title="Resume preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
