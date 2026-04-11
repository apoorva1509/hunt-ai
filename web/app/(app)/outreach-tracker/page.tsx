"use client";

import { useState } from "react";
import {
  useOutreachCompanies,
  useOverdueCount,
} from "@/hooks/use-outreach-tracker";
import { CompanyCard } from "./company-card";
import { AddCompanyDialog } from "./add-company-dialog";
import { useFollowUpNotifications } from "@/hooks/use-follow-up-notifications";
import { Plus, Target } from "lucide-react";
import type { CompanyStatusFilter } from "./types";
import { STATUS_TABS } from "./types";

export default function OutreachTrackerPage() {
  const companies = useOutreachCompanies();
  const overdueCount = useOverdueCount();
  useFollowUpNotifications();
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<CompanyStatusFilter>("all");

  if (companies === undefined) {
    return <p className="text-zinc-500">Loading outreach tracker...</p>;
  }

  const filtered =
    tab === "all"
      ? companies
      : companies.filter((c: any) => c.status === tab);

  const counts: Record<string, number> = { all: companies.length };
  for (const c of companies as any[]) {
    counts[c.status] = (counts[c.status] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            Outreach Tracker ({companies.length})
          </h1>
          {overdueCount !== undefined && overdueCount > 0 && (
            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
              {overdueCount} follow-up{overdueCount !== 1 ? "s" : ""} due
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <Plus className="h-4 w-4" />
          Add Company
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {STATUS_TABS.map(({ key, label }) => (
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

      {/* Company cards */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <Target className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-3 text-sm text-zinc-500">
            {tab === "all"
              ? 'No companies tracked yet. Click "Add Company" to get started.'
              : `No ${tab} companies.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((company: any) => (
            <CompanyCard key={company._id} company={company} />
          ))}
        </div>
      )}

      <AddCompanyDialog open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
