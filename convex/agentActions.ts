import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireOwner } from "./helpers/access";

export const listForAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    return await ctx.db
      .query("agentActions")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .collect();
  },
});

export const addAction = mutation({
  args: {
    agentId: v.id("agents"),
    actionRef: v.string(),
    isEnabled: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.agentId);

    // Dedup by agent + ref
    const existing = await ctx.db
      .query("agentActions")
      .withIndex("by_agent_and_ref", (q) =>
        q.eq("agentId", args.agentId).eq("actionRef", args.actionRef)
      )
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("agentActions", args);
  },
});

export const updateAction = mutation({
  args: {
    id: v.id("agentActions"),
    isEnabled: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const action = await ctx.db.get(id);
    if (!action) throw new Error("Action not found");
    await requireOwner(ctx, action.agentId);

    const updates: Record<string, unknown> = {};
    if (fields.isEnabled !== undefined) updates.isEnabled = fields.isEnabled;
    if (fields.sortOrder !== undefined) updates.sortOrder = fields.sortOrder;
    await ctx.db.patch(id, updates);
  },
});

export const removeAction = mutation({
  args: { id: v.id("agentActions") },
  handler: async (ctx, { id }) => {
    const action = await ctx.db.get(id);
    if (!action) throw new Error("Action not found");
    await requireOwner(ctx, action.agentId);
    await ctx.db.delete(id);
  },
});
