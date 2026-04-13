"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ExternalLink,
  Trash2,
  MapPin,
  DollarSign,
  SkipForward,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  Ban,
  ChevronDown,
  ChevronRight,
  Pencil,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

const STATUS_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  pending: {
    icon: Clock,
    color: "text-zinc-500",
    bg: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    label: "Pending",
  },
  processing: {
    icon: Loader2,
    color: "text-blue-500",
    bg: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    label: "Processing",
  },
  evaluated: {
    icon: CheckCircle,
    color: "text-green-500",
    bg: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    label: "Evaluated",
  },
  failed: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    label: "Failed",
  },
  skipped: {
    icon: Ban,
    color: "text-zinc-400",
    bg: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
    label: "Skipped",
  },
};

const WORK_MODE_COLORS: Record<string, string> = {
  remote:
    "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  hybrid: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  onsite:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

interface TrackerUrl {
  _id: Id<"trackerUrls">;
  url: string;
  status: string;
  title?: string;
  company?: string;
  score?: number;
  archetype?: string;
  location?: string;
  workMode?: string;
  salary?: string;
  notes?: string;
  error?: string;
  addedAt: number;
  processedAt?: number;
}

export function TrackerCard({ item }: { item: TrackerUrl }) {
  const [expanded, setExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(item.notes ?? "");
  const updateStatus = useMutation(api.trackerUrls.updateStatus);
  const updateNotes = useMutation(api.trackerUrls.updateNotes);
  const remove = useMutation(api.trackerUrls.remove);

  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const hasResult = item.title || item.company;
  const addedDate = new Date(item.addedAt).toLocaleDateString();

  const handleSaveNotes = async () => {
    await updateNotes({ id: item._id, notes: notesValue });
    setEditingNotes(false);
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span className="mt-0.5 text-zinc-400">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
        <StatusIcon
          className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.color} ${item.status === "processing" ? "animate-spin" : ""}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {hasResult ? (
                <h3 className="font-medium">
                  {item.company} — {item.title}
                </h3>
              ) : (
                <h3 className="font-medium truncate text-zinc-600 dark:text-zinc-400">
                  {item.url}
                </h3>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg}`}>
                  {cfg.label}
                </span>
                {item.workMode && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${WORK_MODE_COLORS[item.workMode] ?? "bg-zinc-100 text-zinc-500"}`}
                  >
                    {item.workMode}
                  </span>
                )}
                {item.location && (
                  <span className="flex items-center gap-0.5 text-xs text-zinc-500">
                    <MapPin className="h-3 w-3" />
                    {item.location}
                  </span>
                )}
                {item.salary && (
                  <span className="flex items-center gap-0.5 text-xs text-zinc-500">
                    <DollarSign className="h-3 w-3" />
                    {item.salary}
                  </span>
                )}
                {item.archetype && (
                  <span className="text-xs text-zinc-400">
                    {item.archetype}
                  </span>
                )}
                <span className="text-xs text-zinc-400">{addedDate}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {item.score !== undefined && (
                <span
                  className={`text-lg font-bold ${
                    item.score >= 80
                      ? "text-green-600"
                      : item.score >= 60
                        ? "text-amber-600"
                        : "text-red-500"
                  }`}
                >
                  {item.score}
                </span>
              )}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-3 dark:border-zinc-800/50">
          {/* URL */}
          <div className="mb-3">
            <p className="text-xs font-medium text-zinc-500">URL</p>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline break-all"
            >
              {item.url}
            </a>
          </div>

          {/* Error */}
          {item.error && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
              {item.error}
            </div>
          )}

          {/* Notes */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-medium text-zinc-500">Notes</p>
              {!editingNotes && (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveNotes();
                    if (e.key === "Escape") setEditingNotes(false);
                  }}
                />
                <button
                  onClick={handleSaveNotes}
                  className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                >
                  Save
                </button>
              </div>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {item.notes || "—"}
              </p>
            )}
          </div>

          {/* Timestamps */}
          <div className="mb-3 grid grid-cols-2 gap-3 text-xs text-zinc-400">
            <div>
              Added: {new Date(item.addedAt).toLocaleString()}
            </div>
            {item.processedAt && (
              <div>
                Processed: {new Date(item.processedAt).toLocaleString()}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800/50">
            {item.status === "pending" && (
              <button
                onClick={() =>
                  updateStatus({ id: item._id, status: "skipped" })
                }
                className="flex items-center gap-1.5 rounded-md bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
              >
                <SkipForward className="h-3.5 w-3.5" />
                Skip
              </button>
            )}
            {item.status === "failed" && (
              <button
                onClick={() =>
                  updateStatus({ id: item._id, status: "pending" })
                }
                className="rounded-md bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300"
              >
                Retry
              </button>
            )}
            {item.status === "skipped" && (
              <button
                onClick={() =>
                  updateStatus({ id: item._id, status: "pending" })
                }
                className="rounded-md bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300"
              >
                Restore
              </button>
            )}
            <button
              onClick={() => remove({ id: item._id })}
              className="ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
