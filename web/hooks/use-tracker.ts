"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";

export function useTrackerUrls() {
  const { activeAgent } = useAgent();
  return useQuery(
    api.trackerUrls.list,
    activeAgent ? { agentId: activeAgent._id } : "skip"
  );
}
