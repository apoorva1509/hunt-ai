"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import Link from "next/link";
import { Calendar, CheckCircle2, Clock, XCircle, Building2 } from "lucide-react";

type TabKey = "upcoming" | "past" | "all";

export default function MeetingsPage() {
  const steps = useQuery(api.outreachSteps.listAllWithCompany, {});
  const [tab, setTab] = useState<TabKey>("upcoming");

  if (steps === undefined) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Meetings</h1>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  // Only show actual meetings/interviews/calls — not generic pipeline steps
  const MEETING_PATTERNS = /interview|call|chat|meet|round|screen|sync|demo|discussion|r1|r2|r3|l1|l2|l3|hm round/i;
  const meetings = steps.filter((s) => MEETING_PATTERNS.test(s.label));

  const upcoming = meetings.filter((s) => s.status === "pending");
  const past = meetings.filter((s) => s.status === "done" || s.status === "skipped");
  const displayed = tab === "upcoming" ? upcoming : tab === "past" ? past : meetings;

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "upcoming", label: "Upcoming", count: upcoming.length },
    { key: "past", label: "Past", count: past.length },
    { key: "all", label: "All", count: meetings.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meetings & Pipeline</h1>
        <p className="text-sm text-zinc-500">
          Track your interview pipeline across all companies
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {label}
            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-600">
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-12 dark:border-zinc-700">
          <Calendar className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-500">
            {tab === "upcoming"
              ? "No upcoming meetings"
              : tab === "past"
                ? "No past meetings"
                : "No pipeline steps yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((step) => (
            <Link
              key={step._id}
              href={`/outreach-tracker?company=${step.companyId}`}
              className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            >
              {/* Status icon */}
              <div className="flex-shrink-0">
                {step.status === "pending" ? (
                  <Clock className="h-5 w-5 text-amber-500" />
                ) : step.status === "done" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-zinc-400" />
                )}
              </div>

              {/* Company logo + info */}
              <div className="flex flex-1 items-center gap-3">
                {step.companyLogoUrl ? (
                  <img
                    src={step.companyLogoUrl}
                    alt={step.companyName}
                    className="h-8 w-8 rounded-md object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
                    <Building2 className="h-4 w-4 text-zinc-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{step.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <span>{step.companyName}</span>
                    {step.roleAppliedFor && (
                      <>
                        <span className="text-zinc-300 dark:text-zinc-600">&middot;</span>
                        <span>{step.roleAppliedFor}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <span
                className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  step.status === "pending"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : step.status === "done"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {step.status === "pending"
                  ? "Upcoming"
                  : step.status === "done"
                    ? "Completed"
                    : "Skipped"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
