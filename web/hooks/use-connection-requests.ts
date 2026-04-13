"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";
import type { Id } from "@/convex/_generated/dataModel";

export function useConnectionRequests() {
  const { activeAgent } = useAgent();

  return useQuery(
    api.connectionRequests.getByAgent,
    activeAgent ? { agentId: activeAgent._id } : "skip"
  );
}

export function useConnectionsByCompany(companyId: Id<"companies"> | null) {
  const { activeAgent } = useAgent();

  return useQuery(
    api.connectionRequests.getByCompany,
    activeAgent && companyId
      ? { agentId: activeAgent._id, companyId }
      : "skip"
  );
}

export function usePendingConnections() {
  const { activeAgent } = useAgent();

  return useQuery(
    api.connectionRequests.getByStatus,
    activeAgent
      ? { agentId: activeAgent._id, status: "pending" as const }
      : "skip"
  );
}
