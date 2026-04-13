import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePerson } from "./helpers/auth";
import { requireOwner } from "./helpers/access";

const itemStatusValidator = v.union(
  v.literal("new"),
  v.literal("approved"),
  v.literal("actioned"),
  v.literal("done"),
  v.literal("skipped"),
  v.literal("failed")
);

const itemTypeValidator = v.union(
  v.literal("job_lead"),
  v.literal("contact"),
  v.literal("outreach_draft"),
  v.literal("reply"),
  v.literal("trade_signal"),
  v.literal("trade_order"),
  v.literal("signal"),
  v.literal("company_analysis")
);

export const getItem = query({
  args: { id: v.id("agentItems") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const getAgentItems = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    return await ctx.db
      .query("agentItems")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .order("desc")
      .take(500);
  },
});

export const getItemsByType = query({
  args: {
    agentId: v.id("agents"),
    type: itemTypeValidator,
  },
  handler: async (ctx, { agentId, type }) => {
    return await ctx.db
      .query("agentItems")
      .withIndex("by_agent_and_type", (q) =>
        q.eq("agentId", agentId).eq("type", type)
      )
      .order("desc")
      .take(100);
  },
});

export const getChildItems = query({
  args: { parentId: v.id("agentItems") },
  handler: async (ctx, { parentId }) => {
    return await ctx.db
      .query("agentItems")
      .withIndex("by_parent", (q) => q.eq("parentId", parentId))
      .take(50);
  },
});

export const getApprovedDrafts = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    return await ctx.db
      .query("agentItems")
      .withIndex("by_agent_and_type", (q) =>
        q.eq("agentId", agentId).eq("type", "outreach_draft")
      )
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();
  },
});

// No auth -- runner-facing
export const createItem = mutation({
  args: {
    agentId: v.id("agents"),
    runId: v.optional(v.id("agentRuns")),
    parentId: v.optional(v.id("agentItems")),
    type: itemTypeValidator,
    title: v.string(),
    subtitle: v.optional(v.string()),
    personId: v.optional(v.id("people")),
    companyId: v.optional(v.id("companies")),
    data: v.any(),
    actions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentItems", {
      ...args,
      status: "new",
      updatedAt: Date.now(),
    });
  },
});

// Auth required
export const updateItemStatus = mutation({
  args: {
    itemId: v.id("agentItems"),
    status: itemStatusValidator,
  },
  handler: async (ctx, { itemId, status }) => {
    await requirePerson(ctx);
    await ctx.db.patch(itemId, { status, updatedAt: Date.now() });
  },
});

// Auth required
export const updateUserStatus = mutation({
  args: {
    itemId: v.id("agentItems"),
    userStatus: v.string(),
  },
  handler: async (ctx, { itemId, userStatus }) => {
    await requirePerson(ctx);
    await ctx.db.patch(itemId, { userStatus, updatedAt: Date.now() });
  },
});

// No auth -- runner-facing
export const patchItemData = mutation({
  args: {
    itemId: v.id("agentItems"),
    data: v.any(),
  },
  handler: async (ctx, { itemId, data }) => {
    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Item not found");
    await ctx.db.patch(itemId, {
      data: { ...item.data, ...data },
      updatedAt: Date.now(),
    });
  },
});

// Auth required, owner only
export const clearAgentData = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    await requireOwner(ctx, agentId);

    // Delete all items
    const items = await ctx.db
      .query("agentItems")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    // Delete all runs
    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .collect();
    for (const run of runs) {
      await ctx.db.delete(run._id);
    }

    // Delete all tracker URLs
    const trackerUrls = await ctx.db
      .query("trackerUrls")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .collect();
    for (const url of trackerUrls) {
      await ctx.db.delete(url._id);
    }
  },
});

