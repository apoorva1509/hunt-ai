"use client";

import { useState } from "react";
import {
  useOutreachCompanies,
  useOverdueCount,
} from "@/hooks/use-outreach-tracker";
import { CompanyCard } from "./company-card";
import { AddCompanyDialog } from "./add-company-dialog";
import { useFollowUpNotifications } from "@/hooks/use-follow-up-notifications";
import { ImportLinkedinDialog } from "./import-linkedin-dialog";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Download, Plus, Target, Zap } from "lucide-react";
import type { CompanyStatusFilter } from "./types";
import { STATUS_TABS } from "./types";
import { ConnectTab } from "./connect-tab";

type PageView = "tracker" | "connect";

export default function OutreachTrackerPage() {
  const companies = useOutreachCompanies();
  const overdueCount = useOverdueCount();
  useFollowUpNotifications();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const createMessage = useMutation(api.outreachMessages.create);
  const [tab, setTab] = useState<CompanyStatusFilter>("all");
  const [view, setView] = useState<PageView>("tracker");

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
        </>
      )}

      <AddCompanyDialog open={showAdd} onClose={() => setShowAdd(false)} />
      <ImportLinkedinDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={async (data) => {
          try {
            // Find matching contact by LinkedIn URL
            const allContacts = await fetch("/api/noop").catch(() => null); // unused
            // We need to match across companies — use listAll query via HTTP
            const normalize = (url: string) =>
              url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");

            let matchedContact: any = null;
            for (const company of companies ?? []) {
              // We don't have contacts loaded for all companies here,
              // so use the HTTP endpoint which has access to all contacts
            }

            // Call the Convex HTTP endpoint from the web app (same origin policy is fine
            // since the web app isn't on LinkedIn's CSP-restricted domain)
            const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://steady-opossum-661.convex.cloud";
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
            importStatus.startsWith("Error")
              ? "bg-red-500"
              : "bg-green-500"
          }`}
        >
          {importStatus}
        </div>
      )}
    </div>
  );
}
