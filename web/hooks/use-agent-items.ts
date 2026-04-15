"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";
import type { JobLeadData, ContactData, OutreachDraftData } from "@/lib/types";

type ItemType = "job_lead" | "contact" | "outreach_draft";

export function useAgentItems(type?: ItemType) {
  const { activeAgent } = useAgent();

  const allItems = useQuery(
    type ? api.agentItems.getItemsByType : api.agentItems.getAgentItems,
    activeAgent
      ? type
        ? ({ agentId: activeAgent._id, type } as any)
        : { agentId: activeAgent._id }
      : "skip"
  );

  return allItems;
}

export function useChildItems(parentId: string | undefined) {
  const items = useQuery(
    api.agentItems.getChildItems,
    parentId ? { parentId: parentId as any } : "skip"
  );
  return items;
}

export function useJobLeads() {
  const items = useAgentItems("job_lead");
  return items?.map((item: any) => ({
    ...item,
    data: item.data as JobLeadData,
  }));
}

export function useContacts() {
  const items = useAgentItems("contact");
  return items?.map((item: any) => ({
    ...item,
    data: item.data as ContactData,
  }));
}

export function useOutreachDrafts() {
  const items = useAgentItems("outreach_draft");
  return items?.map((item: any) => ({
    ...item,
    data: item.data as OutreachDraftData,
  }));
}
