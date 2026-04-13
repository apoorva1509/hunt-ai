"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MapPin,
  DollarSign,
  FileText,
  Copy,
  Check,
  Briefcase,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type { LeadItem } from "./types";
import { WORK_MODE_LABELS, SOURCE_LABELS, SCORE_LABELS } from "./types";
import { scoreColor, scoreBg, formatSalary } from "./utils";

export function RoleCard({ lead }: { lead: LeadItem }) {
  const [expanded, setExpanded] = useState(false);
  const [showJD, setShowJD] = useState(false);
  const [copied, setCopied] = useState(false);
  const updateStatus = useMutation(api.agentItems.updateItemStatus);
  const d = lead.data;

  const wm = WORK_MODE_LABELS[d.workMode ?? "unknown"];
  const source = SOURCE_LABELS[d.jobBoard] ?? d.jobBoard;
  const salary = formatSalary(d.salary, d.compensationRange);

  const copyJD = async () => {
    const text = `${d.company} -- ${d.role}\n${d.url}\n\n${d.fullDescription ?? "No JD available"}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 dark:border-zinc-700/50 dark:bg-zinc-900/50">
      {/* Role header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-zinc-400">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium truncate">{d.role}</h4>
            <a
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-zinc-400 hover:text-blue-500 shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              {d.archetype.replace(/_/g, " ")}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${wm.color}`}>
              {wm.label}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {source}
            </span>
            {d.location && (
              <span className="flex items-center gap-0.5 text-[11px] text-zinc-500">
                <MapPin className="h-3 w-3" />
                {d.location}
              </span>
            )}
            {salary && (
              <span className="flex items-center gap-0.5 text-[11px] text-zinc-500">
                <DollarSign className="h-3 w-3" />
                {salary}
              </span>
            )}
          </div>
        </div>

        <span
          className={`text-lg font-bold shrink-0 ${scoreColor(d.matchScore)}`}
        >
          {d.matchScore}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-zinc-200 px-4 pb-4 pt-3 dark:border-zinc-700/50">
          {/* Score dimensions grid */}
          <div className="grid grid-cols-5 gap-1.5">
            {Object.entries(d.scoreDimensions)
              .filter(([k]) => k !== "total")
              .map(([key, val]) => (
                <div
                  key={key}
                  className={`rounded-md px-2 py-1.5 text-center ${scoreBg(val as number)}`}
                >
                  <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    {SCORE_LABELS[key] ?? key}
                  </p>
                  <p className={`text-sm font-semibold ${scoreColor(val as number)}`}>
                    {val as number}
                  </p>
                </div>
              ))}
          </div>

          {/* JD section */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowJD(!showJD)}
                className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                <FileText className="h-4 w-4" />
                Job Description
                {showJD ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
              <button
                onClick={copyJD}
                className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copied" : "Copy JD"}
              </button>
            </div>
            {showJD && d.fullDescription && (
              <pre className="mt-2 max-h-[300px] overflow-auto rounded-lg border border-zinc-200 bg-white p-3 font-sans text-xs leading-relaxed text-zinc-600 whitespace-pre-wrap dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                {d.fullDescription}
              </pre>
            )}
            {showJD && !d.fullDescription && (
              <p className="mt-2 text-xs text-zinc-400">
                No job description scraped for this role.
              </p>
            )}
          </div>

          {/* Analysis */}
          <div className="mt-4 grid grid-cols-2 gap-2.5 text-sm">
            <AnalysisCard title="Core Pain" text={d.corePain} />
            <AnalysisCard title="Match Reason" text={d.matchReason} />
            <AnalysisCard title="AI Gap" text={d.aiGap} />
            <AnalysisCard title="Urgency Signal" text={d.urgencySignal} />
          </div>

          {/* Tech stack */}
          {d.techStack?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {d.techStack.map((t: string) => (
                <span
                  key={t}
                  className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700/50">
            {lead.status === "new" && (
              <>
                <button
                  onClick={() =>
                    updateStatus({
                      itemId: lead._id as Id<"agentItems">,
                      status: "approved",
                    })
                  }
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() =>
                    updateStatus({
                      itemId: lead._id as Id<"agentItems">,
                      status: "skipped",
                    })
                  }
                  className="rounded-md bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-300 transition-colors dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Skip
                </button>
              </>
            )}
            {lead.status !== "new" && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 capitalize dark:bg-zinc-800">
                {lead.status}
              </span>
            )}
            <button
              onClick={copyJD}
              className="ml-auto flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              title="Copy JD to clipboard, then use /career-ops pdf to generate a tailored resume"
            >
              <Briefcase className="h-3.5 w-3.5" />
              Tailor Resume
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </p>
      <p className="mt-0.5 text-xs text-zinc-700 dark:text-zinc-300">
        {text}
      </p>
    </div>
  );
}
