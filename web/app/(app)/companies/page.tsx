"use client";

import { useState } from "react";
import { useAgent } from "@/components/providers/agent-provider";
import { useConnectionRequests } from "@/hooks/use-connection-requests";
import { useAgentItems } from "@/hooks/use-agent-items";
import Link from "next/link";
import { Building2, Users, Briefcase, ChevronRight } from "lucide-react";
import { formatTimeAgo } from "./utils";

type FilterTab = "all" | "active" | "archived";

export default function CompaniesPage() {
  const { activeAgent } = useAgent();
  const connections = useConnectionRequests();
  const leads = useAgentItems("job_lead");
  const [tab, setTab] = useState<FilterTab>("all");

  if (!activeAgent) {
    return <p className="text-zinc-500">Select an agent first.</p>;
  }

  if (connections === undefined || leads === undefined) {
    return <p className="text-zinc-500">Loading companies...</p>;
  }

  // Build company map from connections + leads
  const companyMap = new Map<
    string,
    {
      companyId: string;
      name: string;
      leadsCount: number;
      connectionsCount: number;
      acceptedCount: number;
      pendingCount: number;
      lastActivityAt: number;
      hasActiveWork: boolean;
    }
  >();

  for (const conn of connections) {
    const id = conn.companyId;
    const existing = companyMap.get(id) ?? {
      companyId: id,
      name: "",
      leadsCount: 0,
      connectionsCount: 0,
      acceptedCount: 0,
      pendingCount: 0,
      lastActivityAt: 0,
      hasActiveWork: false,
    };
    existing.connectionsCount++;
    if (conn.status === "accepted") existing.acceptedCount++;
    if (conn.status === "pending") {
      existing.pendingCount++;
      existing.hasActiveWork = true;
    }
    if (conn.updatedAt > existing.lastActivityAt) {
      existing.lastActivityAt = conn.updatedAt;
    }
    companyMap.set(id, existing);
  }

  for (const lead of leads) {
    if (!lead.companyId) continue;
    const id = lead.companyId;
    const existing = companyMap.get(id) ?? {
      companyId: id,
      name: "",
      leadsCount: 0,
      connectionsCount: 0,
      acceptedCount: 0,
      pendingCount: 0,
      lastActivityAt: 0,
      hasActiveWork: false,
    };
    existing.leadsCount++;
    if (lead.data?.company) existing.name = lead.data.company;
    if (
      lead.status === "new" ||
      lead.status === "approved" ||
      lead.status === "actioned"
    ) {
      existing.hasActiveWork = true;
    }
    if (lead.updatedAt > existing.lastActivityAt) {
      existing.lastActivityAt = lead.updatedAt;
    }
    companyMap.set(id, existing);
  }

  const companies = Array.from(companyMap.values()).sort(
    (a, b) => b.lastActivityAt - a.lastActivityAt
  );

  const filtered =
    tab === "all"
      ? companies
      : tab === "active"
        ? companies.filter((c) => c.hasActiveWork)
        : companies.filter((c) => !c.hasActiveWork);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Companies ({companies.length})</h1>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
        {(["all", "active", "archived"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Company list */}
      {filtered.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          No companies found.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((company) => (
            <Link
              key={company.companyId}
              href={`/companies/${company.companyId}`}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-5 py-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <Building2 className="h-5 w-5 text-zinc-500" />
                </div>
                <div>
                  <p className="font-medium">
                    {company.name || company.companyId}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {company.leadsCount} lead{company.leadsCount !== 1 && "s"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {company.connectionsCount} connection{company.connectionsCount !== 1 && "s"}
                      {company.acceptedCount > 0 && (
                        <span className="text-green-600">
                          ({company.acceptedCount} acc.)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {company.pendingCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {company.pendingCount} pending
                  </span>
                )}
                <span className="text-xs text-zinc-400">
                  {formatTimeAgo(company.lastActivityAt)}
                </span>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

