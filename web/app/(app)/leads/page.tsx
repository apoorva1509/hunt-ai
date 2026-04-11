"use client";

import { useState } from "react";
import { useAgent } from "@/components/providers/agent-provider";
import { useJobLeads } from "@/hooks/use-agent-items";
import { Briefcase } from "lucide-react";
import type { StatusFilter, LeadItem } from "./types";
import { STATUS_TABS } from "./types";
import { groupLeadsByCompany, countByStatus } from "./utils";
import { CompanyCard } from "./company-card";

export default function LeadsPage() {
  const { activeAgent } = useAgent();
  const leads = useJobLeads();
  const [minScore, setMinScore] = useState(0);
  const [statusTab, setStatusTab] = useState<StatusFilter>("all");

  if (!activeAgent) {
    return <p className="text-zinc-500">Select an agent first.</p>;
  }

  if (leads === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          <p className="text-sm text-zinc-500">Loading leads...</p>
        </div>
      </div>
    );
  }

  const allLeads = leads as LeadItem[];
  const counts = countByStatus(allLeads);
  const companyGroups = groupLeadsByCompany(allLeads, minScore, statusTab);
  const totalRoles = companyGroups.reduce(
    (sum, g) => sum + g.leads.length,
    0
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Job Leads
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {companyGroups.length}{" "}
            {companyGroups.length === 1 ? "company" : "companies"},{" "}
            {totalRoles} {totalRoles === 1 ? "role" : "roles"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-zinc-500">Min Score:</label>
          <input
            type="range"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-32 accent-blue-600"
          />
          <span className="w-8 text-right text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
            {minScore}
          </span>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {STATUS_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusTab(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              statusTab === key
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

      {/* Company cards or empty state */}
      {companyGroups.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <Briefcase className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-4 text-sm font-medium text-zinc-500">
            {statusTab === "all"
              ? "No leads found. Run the pipeline to discover jobs."
              : `No ${statusTab} leads.`}
          </p>
          {minScore > 0 && (
            <p className="mt-1 text-xs text-zinc-400">
              Try lowering the minimum score filter.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {companyGroups.map((group, i) => (
            <CompanyCard key={group.name} group={group} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
