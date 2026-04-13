"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";
import type { Id } from "@/convex/_generated/dataModel";

export function useCompanyDetail(companyId: Id<"companies"> | null) {
  const { activeAgent } = useAgent();

  const connections = useQuery(
    api.connectionRequests.getByCompany,
    activeAgent && companyId
      ? { agentId: activeAgent._id, companyId }
      : "skip"
  );

  const allLeads = useQuery(
    api.agentItems.getItemsByType,
    activeAgent
      ? { agentId: activeAgent._id, type: "job_lead" as const }
      : "skip"
  );

  const allDrafts = useQuery(
    api.agentItems.getItemsByType,
    activeAgent
      ? { agentId: activeAgent._id, type: "outreach_draft" as const }
      : "skip"
  );

  const companyLeads = allLeads?.filter(
    (l: any) => l.companyId === companyId
  );

  const companyDrafts = allDrafts?.filter(
    (d: any) => d.companyId === companyId
  );

  const isLoading =
    connections === undefined ||
    allLeads === undefined ||
    allDrafts === undefined;

  return { connections, leads: companyLeads, drafts: companyDrafts, isLoading };
}
