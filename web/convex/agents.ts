import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePerson, getCurrentPerson } from "./helpers/auth";
import { checkAgentAccess, requireOwner } from "./helpers/access";

export const getMyAgents = query({
  args: {},
  handler: async (ctx) => {
    const person = await getCurrentPerson(ctx);
    if (!person) return [];

    const seen = new Set<string>();
    const results = [];

    // Branch 1: Owned agents
    const owned = await ctx.db
      .query("agents")
      .withIndex("by_owner", (q) => q.eq("ownerPersonId", person._id))
      .collect();
    for (const agent of owned) {
      seen.add(agent._id);
      results.push({ ...agent, accessRole: "owner" as const });
    }

    // Branch 2: Person grants
    const personGrants = await ctx.db
      .query("agentAccess")
      .withIndex("by_person", (q) => q.eq("personId", person._id))
      .collect();
    for (const grant of personGrants) {
      if (seen.has(grant.agentId)) continue;
      const agent = await ctx.db.get(grant.agentId);
      if (agent) {
        seen.add(agent._id);
        results.push({ ...agent, accessRole: "grantee" as const });
      }
    }

    // Branch 3: Company grants
    const links = await ctx.db
      .query("personCompanyLinks")
      .withIndex("by_person_and_status", (q) =>
        q.eq("personId", person._id).eq("status", "active")
      )
      .collect();
    for (const link of links) {
      const companyGrants = await ctx.db
        .query("agentAccess")
        .withIndex("by_company", (q) => q.eq("companyId", link.companyId))
        .collect();
      for (const grant of companyGrants) {
        if (seen.has(grant.agentId)) continue;
        const agent = await ctx.db.get(grant.agentId);
        if (agent) {
          seen.add(agent._id);
          results.push({ ...agent, accessRole: "grantee" as const });
        }
      }
    }

    return results;
  },
});

export const getAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const role = await checkAgentAccess(ctx, agentId);
    if (!role) throw new Error("Access denied");
    const agent = await ctx.db.get(agentId);
    return agent ? { ...agent, accessRole: role } : null;
  },
});

export const getAgentPublic = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) return null;
    // Return full agent for runner access (config is needed for pipeline)
    return agent;
  },
});

export const getAgentContext = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const role = await checkAgentAccess(ctx, agentId);
    if (!role) throw new Error("Access denied");

    const agent = await ctx.db.get(agentId);
    if (!agent) return null;

    const owner = await ctx.db.get(agent.ownerPersonId);
    const grants = await ctx.db
      .query("agentAccess")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .collect();

    return { ...agent, accessRole: role, owner, grants };
  },
});

export const listMarketplaceAgents = query({
  args: {},
  handler: async (ctx) => {
    const published = await ctx.db
      .query("agents")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .collect();

    const results = [];
    for (const agent of published) {
      const forks = await ctx.db
        .query("agentForks")
        .withIndex("by_source", (q) => q.eq("sourceAgentId", agent._id))
        .collect();
      const owner = await ctx.db.get(agent.ownerPersonId);
      results.push({
        _id: agent._id,
        name: agent.name,
        type: agent.type,
        description: agent.description,
        ownerName: owner?.name,
        forkCount: forks.length,
      });
    }
    return results;
  },
});

export const createAgent = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("job_hunter"),
      v.literal("crypto_trader"),
      v.literal("outreach_scout"),
      v.literal("contact_crafter")
    ),
    config: v.any(),
  },
  handler: async (ctx, { name, type, config }) => {
    const person = await requirePerson(ctx);

    const agentId = await ctx.db.insert("agents", {
      ownerPersonId: person._id,
      name,
      type,
      status: "active",
      config,
      updatedAt: Date.now(),
    });

    return agentId;
  },
});

export const updateAgent = mutation({
  args: {
    agentId: v.id("agents"),
    config: v.optional(v.any()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("paused"),
        v.literal("archived")
      )
    ),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { agentId, ...fields }) => {
    await requireOwner(ctx, agentId);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(agentId, updates);
  },
});

export const grantAccess = mutation({
  args: {
    agentId: v.id("agents"),
    personId: v.optional(v.id("people")),
    companyId: v.optional(v.id("companies")),
  },
  handler: async (ctx, { agentId, personId, companyId }) => {
    const person = await requirePerson(ctx);
    await requireOwner(ctx, agentId);

    if (!personId && !companyId) {
      throw new Error("Must provide either personId or companyId");
    }

    return await ctx.db.insert("agentAccess", {
      agentId,
      personId,
      companyId,
      grantedBy: person._id,
    });
  },
});

export const setPublished = mutation({
  args: {
    agentId: v.id("agents"),
    isPublished: v.boolean(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { agentId, isPublished, description }) => {
    await requireOwner(ctx, agentId);
    const updates: Record<string, unknown> = {
      isPublished,
      updatedAt: Date.now(),
    };
    if (description !== undefined) updates.description = description;
    await ctx.db.patch(agentId, updates);
  },
});

export const forkAgent = mutation({
  args: {
    sourceAgentId: v.id("agents"),
    name: v.string(),
  },
  handler: async (ctx, { sourceAgentId, name }) => {
    const person = await requirePerson(ctx);
    const source = await ctx.db.get(sourceAgentId);
    if (!source) throw new Error("Source agent not found");

    // Strip personal data from config
    const strippedConfig = { ...source.config };
    if (strippedConfig) {
      delete strippedConfig.resumeText;
      delete strippedConfig.candidateProfile;
      delete strippedConfig.tools;
      if (strippedConfig.resumes) strippedConfig.resumes = {};
    }

    const forkedId = await ctx.db.insert("agents", {
      ownerPersonId: person._id,
      name,
      type: source.type,
      status: "active",
      config: strippedConfig,
      description: source.description,
      updatedAt: Date.now(),
    });

    // Record the fork
    await ctx.db.insert("agentForks", {
      sourceAgentId,
      forkedAgentId: forkedId,
      forkedByPersonId: person._id,
      forkedAt: Date.now(),
    });

    // Copy strategies
    const strategies = await ctx.db
      .query("outreachStrategies")
      .withIndex("by_agent", (q) => q.eq("agentId", sourceAgentId))
      .collect();
    for (const s of strategies) {
      const { _id, _creationTime, agentId: _, ...rest } = s;
      await ctx.db.insert("outreachStrategies", {
        ...rest,
        agentId: forkedId,
        updatedAt: Date.now(),
      });
    }

    // Copy skills
    const skills = await ctx.db
      .query("agentSkills")
      .withIndex("by_agent", (q) => q.eq("agentId", sourceAgentId))
      .collect();
    for (const s of skills) {
      await ctx.db.insert("agentSkills", {
        agentId: forkedId,
        skillRef: s.skillRef,
        isBaseline: s.isBaseline,
        isActive: s.isActive,
        sortOrder: s.sortOrder,
      });
    }

    // Copy actions
    const actions = await ctx.db
      .query("agentActions")
      .withIndex("by_agent", (q) => q.eq("agentId", sourceAgentId))
      .collect();
    for (const a of actions) {
      await ctx.db.insert("agentActions", {
        agentId: forkedId,
        actionRef: a.actionRef,
        isEnabled: a.isEnabled,
        sortOrder: a.sortOrder,
      });
    }

    return forkedId;
  },
});

export const triggerRun = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    await requireOwner(ctx, agentId);
    return await ctx.db.insert("agentRuns", {
      agentId,
      status: "pending",
      triggeredBy: "manual",
    });
  },
});
