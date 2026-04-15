"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  useOutreachCompaniesWithStats,
  useOverdueCount,
} from "@/hooks/use-outreach-tracker";
import { CompanyCard } from "./company-card";
import { AddCompanyDialog } from "./add-company-dialog";
import { useFollowUpNotifications } from "@/hooks/use-follow-up-notifications";
import { ImportLinkedinDialog } from "./import-linkedin-dialog";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Download, Plus, Target, Zap, Search, X } from "lucide-react";
import type { CompanyStatusFilter, OutreachFilter, CompanyStats } from "./types";
import { STATUS_TABS, OUTREACH_FILTERS } from "./types";
import { ConnectTab } from "./connect-tab";

type PageView = "tracker" | "connect";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function matchesOutreachFilter(
  company: any,
  stats: CompanyStats,
  filter: OutreachFilter
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "dms_sent":
      return stats.outboundDMCount > 0;
    case "replied":
      return stats.inboundCount > 0;
    case "no_dms":
      return stats.contactCount > 0 && stats.outboundDMCount === 0;
    case "applied":
      return stats.appliedJobCount > 0;
    case "has_resume":
      return stats.hasResume;
    case "no_contacts":
      return stats.contactCount === 0;
    case "going_cold":
      return (
        stats.totalMessages > 0 &&
        stats.latestMessageAt !== null &&
        Date.now() - stats.latestMessageAt > THREE_DAYS_MS
      );
    case "in_conversation":
      return stats.outboundDMCount > 0 && stats.inboundCount > 0;
    case "yc_backed":
      return company.isYcBacked;
    default:
      return true;
  }
}

function OutreachTrackerContent() {
  const companies = useOutreachCompaniesWithStats();
  const overdueCount = useOverdueCount();
  useFollowUpNotifications();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const createMessage = useMutation(api.outreachMessages.create);
  const [statusTab, setStatusTab] = useState<CompanyStatusFilter>("all");
  const [outreachFilter, setOutreachFilter] = useState<OutreachFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<PageView>("tracker");
  const searchParams = useSearchParams();
  const highlightCompanyId = searchParams.get("company");

  const filtered = useMemo(() => {
    if (!companies) return [];
    let result = companies;

    // Status filter
    if (statusTab !== "all") {
      result = result.filter((c: any) => c.status === statusTab);
    }

    // Outreach filter
    if (outreachFilter !== "all") {
      result = result.filter((c: any) =>
        matchesOutreachFilter(c, c.stats, outreachFilter)
      );
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c: any) =>
          c.name.toLowerCase().includes(q) ||
          (c.domain && c.domain.toLowerCase().includes(q)) ||
          (c.roleAppliedFor && c.roleAppliedFor.toLowerCase().includes(q)) ||
          (c.industry && c.industry.toLowerCase().includes(q)) ||
          (c.description && c.description.toLowerCase().includes(q))
      );
    }

    return result;
  }, [companies, statusTab, outreachFilter, searchQuery]);

  if (companies === undefined) {
    return <p className="text-zinc-500">Loading outreach tracker...</p>;
  }

  const statusCounts: Record<string, number> = { all: companies.length };
  for (const c of companies as any[]) {
    statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
  }

  // Compute outreach filter counts
  const outreachCounts: Record<string, number> = {};
  const statusFiltered =
    statusTab === "all"
      ? companies
      : companies.filter((c: any) => c.status === statusTab);
  for (const f of OUTREACH_FILTERS) {
    outreachCounts[f.key] =
      f.key === "all"
        ? statusFiltered.length
        : statusFiltered.filter((c: any) =>
            matchesOutreachFilter(c, c.stats, f.key)
          ).length;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
            Outreach Tracker
          </h1>
          <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-sm font-semibold text-zinc-300">
            {companies.length}
          </span>
          {overdueCount !== undefined && overdueCount > 0 && (
            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
              {overdueCount} follow-up{overdueCount !== 1 ? "s" : ""} due
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              onClick={() => setView("tracker")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "tracker"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Tracker
            </button>
            <button
              onClick={() => setView("connect")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "connect"
                  ? "bg-white text-purple-700 shadow-sm dark:bg-zinc-800 dark:text-purple-400"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              Connect
            </button>
          </div>
          {view === "tracker" && (
            <>
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Download className="h-4 w-4" />
                Import LinkedIn
              </button>
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                <Plus className="h-4 w-4" />
                Add Company
              </button>
            </>
          )}
        </div>
      </div>

      {view === "connect" ? (
        <ConnectTab />
      ) : (
        <>
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search companies, roles, domains..."
              className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-10 pr-10 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600 dark:focus:ring-zinc-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
            {STATUS_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusTab(key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  statusTab === key
                    ? key === "active"
                      ? "bg-green-500/20 text-green-300 shadow-sm ring-1 ring-green-500/30"
                      : key === "paused"
                        ? "bg-amber-500/20 text-amber-300 shadow-sm ring-1 ring-amber-500/30"
                        : key === "closed"
                          ? "bg-zinc-500/20 text-zinc-300 shadow-sm ring-1 ring-zinc-500/30"
                          : "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                {label}
                {statusCounts[key] !== undefined && (
                  <span className="ml-1.5 text-xs text-zinc-400">
                    {statusCounts[key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Outreach filters */}
          <div className="flex flex-wrap gap-1.5">
            {OUTREACH_FILTERS.map((f) => {
              const count = outreachCounts[f.key] ?? 0;
              if (f.key !== "all" && count === 0) return null;
              const isActive = outreachFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() =>
                    setOutreachFilter(isActive && f.key !== "all" ? "all" : f.key)
                  }
                  title={f.description}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    isActive
                      ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30"
                      : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                >
                  {f.label}
                  <span
                    className={`ml-1 ${
                      isActive ? "text-purple-400" : "text-zinc-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Company cards */}
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
              <Target className="mx-auto h-8 w-8 text-zinc-300" />
              <p className="mt-3 text-sm text-zinc-500">
                {searchQuery
                  ? `No companies matching "${searchQuery}".`
                  : statusTab === "all" && outreachFilter === "all"
                    ? 'No companies tracked yet. Click "Add Company" to get started.'
                    : "No companies match the current filters."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((company: any) => (
                <CompanyCard key={company._id} company={company} initialExpanded={company._id === highlightCompanyId} />
              ))}
            </div>
          )}
        </>
      )}

      <AddCompanyDialog open={showAdd} onClose={() => setShowAdd(false)} />
      <ImportLinkedinDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={async (data) => {
          try {
            const convexUrl =
              process.env.NEXT_PUBLIC_CONVEX_URL ||
              "https://steady-opossum-661.convex.cloud";
            const res = await fetch(convexUrl + "/api/linkedin-sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            const result = await res.json();
            if (result.success) {
              setImportStatus(
                `Synced ${result.synced} messages for ${result.contactName} (${result.skipped} skipped)`
              );
            } else {
              setImportStatus(`Error: ${result.error}`);
            }
            setTimeout(() => setImportStatus(""), 5000);
          } catch (err: any) {
            setImportStatus(`Error: ${err.message}`);
            setTimeout(() => setImportStatus(""), 5000);
          }
        }}
      />
      {importStatus && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            importStatus.startsWith("Error") ? "bg-red-500" : "bg-green-500"
          }`}
        >
          {importStatus}
        </div>
      )}
    </div>
  );
}

export default function OutreachTrackerPage() {
  return (
    <Suspense>
      <OutreachTrackerContent />
    </Suspense>
  );
}
