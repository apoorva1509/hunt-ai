"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";
import { useAgentRuns } from "@/hooks/use-agent-runs";
import {
  Play,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Terminal,
  Trash2,
  StopCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

const STATUS_ICON: Record<string, React.ElementType> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
};

const STATUS_COLOR: Record<string, string> = {
  pending: "text-zinc-500",
  running: "text-blue-500",
  completed: "text-green-500",
  failed: "text-red-500",
};

interface RunFunnel {
  jobsFromSources: number;
  afterTitleFilter: number;
  afterDedup: number;
  liveJobs: number;
  totalCompanies: number;
  companiesProcessed: number;
  companiesWithDMs: number;
  companiesNoDMs: number;
  jobsScored: number;
  jobsBelowThreshold: number;
  leadsCreated: number;
}

function parseSummary(raw: string | undefined): {
  text: string;
  funnel: RunFunnel | null;
} {
  if (!raw) return { text: "", funnel: null };
  try {
    const parsed = JSON.parse(raw);
    return { text: parsed.text ?? raw, funnel: parsed.funnel ?? null };
  } catch {
    return { text: raw, funnel: null };
  }
}

export default function PipelinePage() {
  const { activeAgent } = useAgent();
  const runs = useAgentRuns();
  const triggerRun = useMutation(api.agents.triggerRun);
  const cancelRun = useMutation(api.agentRuns.cancelRun);
  const deleteRun = useMutation(api.agentRuns.deleteRun);
  const [triggered, setTriggered] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  if (!activeAgent) {
    return <p className="text-zinc-500">Select an agent first.</p>;
  }

  if (runs === undefined) {
    return <p className="text-zinc-500">Loading runs...</p>;
  }

  const hasPendingOrRunning = runs.some(
    (r: any) => r.status === "pending" || r.status === "running"
  );

  const handleTrigger = async () => {
    await triggerRun({ agentId: activeAgent._id });
    setTriggered(true);
    setTimeout(() => setTriggered(false), 5000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <button
          onClick={handleTrigger}
          disabled={hasPendingOrRunning}
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <Play className="h-4 w-4" />
          Trigger New Run
        </button>
      </div>

      {/* How it works */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
        <div className="flex items-start gap-3">
          <Terminal className="mt-0.5 h-5 w-5 text-amber-600" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              How the pipeline works
            </p>
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              <strong>1.</strong> Click &quot;Trigger New Run&quot; — creates a
              pending run in the queue.
              <br />
              <strong>2.</strong> The runner picks it up and executes the full
              pipeline (job discovery &rarr; scoring &rarr; outreach).
              <br />
              <strong>3.</strong> Results appear in Leads, Contacts, and
              Outreach pages in real-time.
            </p>
            <p className="mt-2 text-amber-600 dark:text-amber-400">
              Runner command:{" "}
              <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs dark:bg-amber-900">
                cd runner/job-hunter && npx tsx index.ts --watch
              </code>
            </p>
          </div>
        </div>
      </div>

      {triggered && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          Run queued! The runner will pick it up within 5 seconds.
        </div>
      )}

      {/* Runs list */}
      <div className="space-y-3">
        {runs.length === 0 && (
          <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            No pipeline runs yet. Click &quot;Trigger New Run&quot; to start.
          </p>
        )}

        {runs.map((run: any) => {
          const Icon = STATUS_ICON[run.status] ?? Clock;
          const color = STATUS_COLOR[run.status] ?? "text-zinc-500";
          const started = run.startedAt
            ? new Date(run.startedAt).toLocaleString()
            : "—";
          const duration =
            run.startedAt && run.completedAt
              ? `${Math.round((run.completedAt - run.startedAt) / 1000)}s`
              : run.status === "running"
                ? "In progress..."
                : "—";
          const { text: summaryText, funnel } = parseSummary(run.summary);
          const isExpanded = expandedRun === run._id;

          return (
            <div
              key={run._id}
              className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
            >
              {/* Run header */}
              <div className="flex items-center gap-4 px-5 py-3">
                <Icon
                  className={`h-4 w-4 shrink-0 ${color} ${run.status === "running" ? "animate-spin" : ""}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className={`font-medium capitalize ${color}`}>
                      {run.status}
                    </span>
                    <span className="text-xs text-zinc-400">{started}</span>
                    <span className="text-xs text-zinc-400">{duration}</span>
                    <span className="text-xs capitalize text-zinc-400">
                      {run.triggeredBy}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400 truncate">
                    {summaryText || run.error || "—"}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {funnel && (
                    <button
                      onClick={() =>
                        setExpandedRun(isExpanded ? null : run._id)
                      }
                      className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      Funnel
                    </button>
                  )}
                  {(run.status === "running" ||
                    run.status === "pending") && (
                    <button
                      onClick={() =>
                        cancelRun({ runId: run._id as Id<"agentRuns"> })
                      }
                      className="text-zinc-400 hover:text-amber-500"
                      title="Cancel run"
                    >
                      <StopCircle className="h-4 w-4" />
                    </button>
                  )}
                  {(run.status === "failed" ||
                    run.status === "completed") && (
                    <button
                      onClick={() =>
                        deleteRun({ runId: run._id as Id<"agentRuns"> })
                      }
                      className="text-zinc-400 hover:text-red-500"
                      title="Delete run"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Funnel breakdown */}
              {isExpanded && funnel && (
                <FunnelBreakdown funnel={funnel} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FunnelBreakdown({ funnel }: { funnel: RunFunnel }) {
  const steps = [
    {
      label: "Jobs discovered",
      value: funnel.jobsFromSources,
      detail: "From all enabled sources",
    },
    {
      label: "After title filter",
      value: funnel.liveJobs,
      dropped: funnel.jobsFromSources - funnel.liveJobs,
      detail: "Matched positive keywords, excluded negative",
    },
    {
      label: "Unique companies",
      value: funnel.totalCompanies,
      detail: "Distinct companies from matched jobs",
    },
    {
      label: "Companies processed",
      value: funnel.companiesProcessed,
      dropped: funnel.totalCompanies - funnel.companiesProcessed,
      detail: `Top companies by role count (MAX_COMPANIES limit)`,
      warn: funnel.totalCompanies - funnel.companiesProcessed > 20,
    },
    {
      label: "Had decision makers",
      value: funnel.companiesWithDMs,
      dropped: funnel.companiesNoDMs,
      detail: "LinkedIn DM search found contacts",
      warn: funnel.companiesNoDMs > funnel.companiesWithDMs,
    },
    {
      label: "Jobs scored",
      value: funnel.jobsScored,
      detail: "Jobs at companies with DMs",
    },
    {
      label: "Below threshold",
      value: funnel.jobsBelowThreshold,
      detail: "Score below MIN_MATCH_SCORE",
      isNegative: true,
    },
    {
      label: "Leads created",
      value: funnel.leadsCreated,
      detail: "Final leads in your dashboard",
      isResult: true,
    },
  ];

  return (
    <div className="border-t border-zinc-100 px-5 py-4 dark:border-zinc-800/50">
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
        Pipeline Funnel
      </h4>
      <div className="space-y-1.5">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-3 text-sm">
            <div className="w-44 shrink-0">
              <span
                className={
                  step.isResult
                    ? "font-semibold text-green-600"
                    : step.isNegative
                      ? "text-red-500"
                      : "text-zinc-600 dark:text-zinc-400"
                }
              >
                {step.label}
              </span>
            </div>
            <div className="w-16 text-right font-mono">
              <span
                className={
                  step.isResult
                    ? "font-bold text-green-600"
                    : step.isNegative
                      ? "text-red-500"
                      : ""
                }
              >
                {step.value}
              </span>
            </div>
            {step.dropped !== undefined && step.dropped > 0 && (
              <span
                className={`text-xs ${step.warn ? "font-medium text-amber-500" : "text-zinc-400"}`}
              >
                (-{step.dropped})
              </span>
            )}
            <span className="text-xs text-zinc-400">{step.detail}</span>
          </div>
        ))}
      </div>

      {/* Actionable insights */}
      {funnel.companiesNoDMs > funnel.companiesWithDMs && (
        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400">
          <strong>Note:</strong> {funnel.companiesNoDMs}/
          {funnel.companiesProcessed} companies had no DMs found. Leads were
          still created but without outreach drafts.
        </div>
      )}
      {funnel.totalCompanies - funnel.companiesProcessed > 20 && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
          <strong>Bottleneck:</strong>{" "}
          {funnel.totalCompanies - funnel.companiesProcessed} companies were
          skipped due to MAX_COMPANIES limit. Increase MAX_COMPANIES in
          runner/.env to process more.
        </div>
      )}
      {funnel.jobsBelowThreshold > 0 &&
        funnel.leadsCreated === 0 && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
            <strong>Bottleneck:</strong> All {funnel.jobsBelowThreshold} scored
            jobs were below threshold. Consider lowering MIN_MATCH_SCORE in
            runner/.env.
          </div>
        )}
    </div>
  );
}
