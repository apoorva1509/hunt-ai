import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import type { AgentConfig, OutreachStrategy } from "./types.js";

const CONVEX_URL = process.env.CONVEX_URL ?? "";
const AGENT_ID = process.env.AGENT_ID ?? "";

let client: ConvexHttpClient | null = null;

function getClient(): ConvexHttpClient {
  if (!client) {
    if (!CONVEX_URL) throw new Error("CONVEX_URL not set");
    client = new ConvexHttpClient(CONVEX_URL);
  }
  return client;
}

// ── Read ─────────────────────────────────────────────────────

export async function loadAgentConfig(): Promise<{
  agentId: string;
  config: AgentConfig;
  strategies: OutreachStrategy[];
}> {
  const c = getClient();
  const agent = await c.query(api.agents.getAgentPublic, { agentId: AGENT_ID as any });
  if (!agent) throw new Error(`Agent ${AGENT_ID} not found`);

  const strategies = await c.query(api.outreachStrategies.list, {
    agentId: AGENT_ID as any,
  });

  return {
    agentId: AGENT_ID,
    config: agent.config as AgentConfig,
    strategies: (strategies ?? []).filter((s: any) => s.isActive) as OutreachStrategy[],
  };
}

export async function getSecret(key: string): Promise<string | null> {
  const c = getClient();
  return await c.action(api.secrets.getSecret, {
    agentId: AGENT_ID as any,
    key,
  });
}

// ── Write ────────────────────────────────────────────────────

export async function startRun(triggeredBy: "manual" | "schedule" = "manual") {
  const c = getClient();
  return await c.mutation(api.agentRuns.startRun, {
    agentId: AGENT_ID as any,
    triggeredBy,
  });
}

export async function finishRun(
  runId: string,
  status: "completed" | "failed",
  summary?: string,
  error?: string
) {
  const c = getClient();
  await c.mutation(api.agentRuns.finishRun, {
    runId: runId as any,
    status,
    summary,
    error,
  });
}

export async function createItem(args: {
  runId?: string;
  parentId?: string;
  type: string;
  title: string;
  subtitle?: string;
  personId?: string;
  companyId?: string;
  data: any;
  actions?: string[];
}) {
  const c = getClient();
  return await c.mutation(api.agentItems.createItem, {
    agentId: AGENT_ID as any,
    runId: args.runId as any,
    parentId: args.parentId as any,
    type: args.type as any,
    title: args.title,
    subtitle: args.subtitle,
    data: args.data,
    actions: args.actions,
  });
}

export async function patchItemData(itemId: string, data: any) {
  const c = getClient();
  await c.mutation(api.agentItems.patchItemData, {
    itemId: itemId as any,
    data,
  });
}

// ── Watch Mode Helpers ──────────────────────────────────────

export async function getPendingRuns(): Promise<
  Array<{ _id: string; agentId: string; triggeredBy: string }>
> {
  const c = getClient();
  return await c.query(api.agentRuns.getPendingRuns, {});
}

export async function claimRun(
  runId: string
): Promise<{ _id: string; agentId: string } | null> {
  const c = getClient();
  return await c.mutation(api.agentRuns.claimRun, {
    runId: runId as any,
  });
}

export async function loadAgentConfigById(agentId: string): Promise<{
  agentId: string;
  config: AgentConfig;
  strategies: OutreachStrategy[];
}> {
  const c = getClient();
  const agent = await c.query(api.agents.getAgentPublic, {
    agentId: agentId as any,
  });
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  const strategies = await c.query(api.outreachStrategies.list, {
    agentId: agentId as any,
  });

  return {
    agentId,
    config: agent.config as AgentConfig,
    strategies: (strategies ?? []).filter((s: any) => s.isActive) as OutreachStrategy[],
  };
}

// ── Tracker URL Helpers (for watch mode) ────────────────────

export async function getPendingTrackerUrls(): Promise<
  Array<{ _id: string; agentId: string; url: string; notes?: string }>
> {
  const c = getClient();
  return await c.query(api.trackerUrls.listPending, {});
}

export async function markTrackerProcessing(
  id: string
): Promise<{ _id: string; url: string; agentId: string } | null> {
  const c = getClient();
  return await c.mutation(api.trackerUrls.markProcessing, {
    id: id as any,
  });
}

export async function markTrackerEvaluated(
  id: string,
  result: {
    title?: string;
    company?: string;
    score?: number;
    archetype?: string;
    location?: string;
    workMode?: string;
    salary?: string;
    notes?: string;
  }
) {
  const c = getClient();
  await c.mutation(api.trackerUrls.markEvaluated, {
    id: id as any,
    ...result,
  });
}

export async function markTrackerFailed(id: string, error: string) {
  const c = getClient();
  await c.mutation(api.trackerUrls.markFailed, {
    id: id as any,
    error,
  });
}

export function createItemForAgent(agentId: string) {
  return async (args: {
    runId?: string;
    parentId?: string;
    type: string;
    title: string;
    subtitle?: string;
    data: any;
    actions?: string[];
  }) => {
    const c = getClient();
    return await c.mutation(api.agentItems.createItem, {
      agentId: agentId as any,
      runId: args.runId as any,
      parentId: args.parentId as any,
      type: args.type as any,
      title: args.title,
      subtitle: args.subtitle,
      data: args.data,
      actions: args.actions,
    });
  };
}
