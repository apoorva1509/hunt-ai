"use client";

import { use, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompanyDetail } from "@/hooks/use-company-detail";
import { useAgent } from "@/components/providers/agent-provider";
import { NextStepsPanel } from "@/components/company/next-steps-panel";
import { ApplicationsSection } from "@/components/company/applications-section";
import { ConnectionCard } from "@/components/connections/connection-card";
import { QuickAddModal } from "@/components/connections/quick-add-modal";
import { ActivityTimeline } from "@/components/company/activity-timeline";
import {
  ArrowLeft,
  Building2,
  Users,
  Plus,
  Globe,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";

export default function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const companyId = id as Id<"companies">;
  const { activeAgent } = useAgent();
  const { connections, leads, drafts, isLoading } =
    useCompanyDetail(companyId);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showIntel, setShowIntel] = useState(false);

  // Resolve people names
  const personIds = connections?.map((c: any) => c.personId) ?? [];
  const people = useQuery(
    api.people.getByIds,
    personIds.length > 0 ? { personIds } : "skip"
  );

  const peopleMap = new Map<string, string>();
  if (people) {
    for (const p of people) {
      peopleMap.set(p._id, p.name ?? "Unknown");
    }
  }

  if (!activeAgent) {
    return <p className="text-zinc-500">Select an agent first.</p>;
  }

  if (isLoading) {
    return <p className="text-zinc-500">Loading company details...</p>;
  }

  // Derive company name from leads data
  const companyName =
    leads?.[0]?.data?.company ?? companyId;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/companies"
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
          <Building2 className="h-5 w-5 text-zinc-500" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{companyName}</h1>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>{leads?.length ?? 0} lead{(leads?.length ?? 0) !== 1 && "s"}</span>
            <span>-</span>
            <span>
              {connections?.length ?? 0} connection{(connections?.length ?? 0) !== 1 && "s"}
            </span>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      {connections && connections.length > 0 && (
        <NextStepsPanel connections={connections} people={peopleMap} />
      )}

      {/* Applications */}
      <ApplicationsSection leads={leads ?? []} />

      {/* Connections */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" />
            Connections ({connections?.length ?? 0})
          </h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
        {connections && connections.length > 0 ? (
          <div className="space-y-1.5">
            {connections.map((conn: any) => (
              <ConnectionCard
                key={conn._id}
                connection={conn}
                personName={peopleMap.get(conn.personId)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No connections yet.</p>
        )}
      </div>

      {/* Activity Timeline */}
      {connections && leads && drafts && (
        <ActivityTimeline
          connections={connections}
          leads={leads}
          drafts={drafts}
          people={peopleMap}
        />
      )}

      {/* Company Intel (collapsed) */}
      <button
        onClick={() => setShowIntel(!showIntel)}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
      >
        <span className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Company Intel
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${showIntel ? "rotate-180" : ""}`}
        />
      </button>
      {showIntel && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          <p>Company intel will be populated by agent research runs.</p>
        </div>
      )}

      {/* Quick-add modal */}
      {showAddModal && (
        <QuickAddModal
          companyId={companyId}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
