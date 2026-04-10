"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";

export function useAgentRuns() {
  const { activeAgent } = useAgent();

  const runs = useQuery(
    api.agentRuns.getAgentRuns,
    activeAgent ? { agentId: activeAgent._id } : "skip"
  );

  return runs;
}

export function useLatestRun() {
  const { activeAgent } = useAgent();

  const run = useQuery(
    api.agentRuns.getLatestRun,
    activeAgent ? { agentId: activeAgent._id } : "skip"
  );

  return run;
}
