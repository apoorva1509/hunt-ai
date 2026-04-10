import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireOwner } from "./helpers/access";

export const list = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    return await ctx.db
      .query("outreachStrategies")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .collect();
  },
});

export const create = mutation({
  args: {
    agentId: v.id("agents"),
    name: v.string(),
    description: v.string(),
    angle: v.string(),
    templateNotes: v.string(),
    channel: v.union(
      v.literal("linkedin"),
      v.literal("email"),
      v.literal("whatsapp")
    ),
    goal: v.union(
      v.literal("intro_call"),
      v.literal("connection"),
      v.literal("referral"),
      v.literal("direct_apply"),
      v.literal("reply")
    ),
    regionHints: v.array(v.string()),
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.agentId);
    return await ctx.db.insert("outreachStrategies", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("outreachStrategies"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    angle: v.optional(v.string()),
    templateNotes: v.optional(v.string()),
    channel: v.optional(
      v.union(
        v.literal("linkedin"),
        v.literal("email"),
        v.literal("whatsapp")
      )
    ),
    goal: v.optional(
      v.union(
        v.literal("intro_call"),
        v.literal("connection"),
        v.literal("referral"),
        v.literal("direct_apply"),
        v.literal("reply")
      )
    ),
    regionHints: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const strategy = await ctx.db.get(id);
    if (!strategy) throw new Error("Strategy not found");
    await requireOwner(ctx, strategy.agentId);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("outreachStrategies") },
  handler: async (ctx, { id }) => {
    const strategy = await ctx.db.get(id);
    if (!strategy) throw new Error("Strategy not found");
    await requireOwner(ctx, strategy.agentId);
    await ctx.db.delete(id);
  },
});
