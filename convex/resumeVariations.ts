import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireOwner } from "./helpers/access";

export const list = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    return await ctx.db
      .query("resumeVariations")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .collect();
  },
});

export const getByArchetype = query({
  args: {
    agentId: v.id("agents"),
    archetype: v.string(),
  },
  handler: async (ctx, { agentId, archetype }) => {
    return await ctx.db
      .query("resumeVariations")
      .withIndex("by_agent_and_archetype", (q) =>
        q.eq("agentId", agentId).eq("archetype", archetype)
      )
      .first();
  },
});

export const upsert = mutation({
  args: {
    agentId: v.id("agents"),
    archetype: v.string(),
    googleDocId: v.string(),
    googleDocUrl: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.agentId);

    const existing = await ctx.db
      .query("resumeVariations")
      .withIndex("by_agent_and_archetype", (q) =>
        q.eq("agentId", args.agentId).eq("archetype", args.archetype)
      )
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        googleDocId: args.googleDocId,
        googleDocUrl: args.googleDocUrl,
        title: args.title,
        lastSyncedAt: now,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("resumeVariations", {
      ...args,
      lastSyncedAt: now,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("resumeVariations") },
  handler: async (ctx, { id }) => {
    const variation = await ctx.db.get(id);
    if (!variation) throw new Error("Variation not found");
    await requireOwner(ctx, variation.agentId);
    await ctx.db.delete(id);
  },
});
