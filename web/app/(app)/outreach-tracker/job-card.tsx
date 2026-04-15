"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ExternalLink, Check, X, ChevronDown, ChevronRight, MapPin, Clock } from "lucide-react";
import type { OutreachJob } from "./types";
import { SOURCE_COLORS, SOURCE_LABELS, SOURCE_BORDER_COLORS } from "./types";
import { daysSince } from "./utils";

interface JobCardProps {
  job: OutreachJob;
  onMarkApplied: (jobId: any) => void;
}

export function JobCard({ job, onMarkApplied }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const markSkipped = useMutation(api.outreachJobs.markSkipped);

  const isApplied = job.status === "applied";
  const isSkipped = job.status === "skipped";

  return (
    <div
      className={`rounded-lg border-l-4 border border-zinc-200 dark:border-zinc-800 transition-all ${
        SOURCE_BORDER_COLORS[job.source]
      } ${
        isApplied
          ? "bg-green-50/50 dark:bg-green-950/20"
          : isSkipped
            ? "opacity-50"
            : "bg-white dark:bg-zinc-950"
      }`}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold truncate">{job.title}</h4>
              {isApplied && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  <Check className="h-2.5 w-2.5" />
                  Applied
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SOURCE_COLORS[job.source]}`}>
                {SOURCE_LABELS[job.source]}
              </span>
              {job.location && (
                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                  <MapPin className="h-3 w-3" />
                  {job.location}
                </span>
              )}
              {job.workMode && job.workMode !== "unknown" && (
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {job.workMode}
                </span>
              )}
              {job.postedAt && (
                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                  <Clock className="h-3 w-3" />
                  {daysSince(job.postedAt)}d ago
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isApplied && !isSkipped && (
              <>
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-md bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  <ExternalLink className="h-3 w-3" />
                  Apply
                </a>
                <button
                  onClick={() => onMarkApplied(job._id)}
                  className="rounded-md bg-green-100 px-2.5 py-1.5 text-[11px] font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={() => markSkipped({ id: job._id })}
                  className="rounded-md bg-zinc-100 px-2 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
            {(isApplied || isSkipped) && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {job.description && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>

        {isApplied && job.appliedVia && (
          <p className="mt-1.5 text-[11px] text-zinc-500">
            Applied via {job.appliedVia.replace(/_/g, " ")}{job.appliedNotes ? ` — ${job.appliedNotes}` : ""}
          </p>
        )}
      </div>

      {expanded && job.description && (
        <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <p className={`text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap ${showFullDesc ? "" : "line-clamp-10"}`}>
            {job.description}
          </p>
          {job.description.split("\n").length > 10 && (
            <button
              onClick={() => setShowFullDesc(!showFullDesc)}
              className="mt-1 text-[11px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400"
            >
              {showFullDesc ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
