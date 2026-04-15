import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireOwner } from "./helpers/access";
import { DEFAULT_SKILLS, DEFAULT_ACTIONS } from "./helpers/seeds";

export const listForAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    return await ctx.db
      .query("agentSkills")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .collect();
  },
});

export const addSkill = mutation({
  args: {
    agentId: v.id("agents"),
    skillRef: v.string(),
    isBaseline: v.boolean(),
    isActive: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.agentId);

    // Dedup by agent + ref
    const existing = await ctx.db
      .query("agentSkills")
      .withIndex("by_agent_and_ref", (q) =>
        q.eq("agentId", args.agentId).eq("skillRef", args.skillRef)
      )
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("agentSkills", args);
  },
});

export const updateSkill = mutation({
  args: {
    id: v.id("agentSkills"),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const skill = await ctx.db.get(id);
    if (!skill) throw new Error("Skill not found");
    await requireOwner(ctx, skill.agentId);

    const updates: Record<string, unknown> = {};
    if (fields.isActive !== undefined) updates.isActive = fields.isActive;
    if (fields.sortOrder !== undefined) updates.sortOrder = fields.sortOrder;
    await ctx.db.patch(id, updates);
  },
});

export const removeSkill = mutation({
  args: { id: v.id("agentSkills") },
  handler: async (ctx, { id }) => {
    const skill = await ctx.db.get(id);
    if (!skill) throw new Error("Skill not found");
    await requireOwner(ctx, skill.agentId);
    await ctx.db.delete(id);
  },
});

/**
 * Seed default skills AND actions for a new job_hunter agent.
 */
export const seedJobHunterDefaults = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    await requireOwner(ctx, agentId);

    // Seed skills
    for (const skill of DEFAULT_SKILLS) {
      const existing = await ctx.db
        .query("agentSkills")
        .withIndex("by_agent_and_ref", (q) =>
          q.eq("agentId", agentId).eq("skillRef", skill.skillRef)
        )
        .first();
      if (!existing) {
        await ctx.db.insert("agentSkills", { agentId, ...skill });
      }
    }

    // Seed actions
    for (const action of DEFAULT_ACTIONS) {
      const existing = await ctx.db
        .query("agentActions")
        .withIndex("by_agent_and_ref", (q) =>
          q.eq("agentId", agentId).eq("actionRef", action.actionRef)
        )
        .first();
      if (!existing) {
        await ctx.db.insert("agentActions", { agentId, ...action });
      }
    }
  },
});
