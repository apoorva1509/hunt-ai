import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePerson } from "./helpers/auth";

const contactTypeValidator = v.union(
  v.literal("recruiter"),
  v.literal("hiring_manager"),
  v.literal("peer"),
  v.literal("founder"),
  v.literal("executive"),
  v.literal("other")
);

const connectionStatusValidator = v.union(
  v.literal("suggested"),
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("ignored")
);

export const getByAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    return await ctx.db
      .query("connectionRequests")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .order("desc")
      .take(500);
  },
});

export const getByCompany = query({
  args: { agentId: v.id("agents"), companyId: v.id("companies") },
  handler: async (ctx, { agentId, companyId }) => {
    return await ctx.db
      .query("connectionRequests")
      .withIndex("by_agent_and_company", (q) =>
        q.eq("agentId", agentId).eq("companyId", companyId)
      )
      .order("desc")
      .collect();
  },
});

export const getByStatus = query({
  args: { agentId: v.id("agents"), status: connectionStatusValidator },
  handler: async (ctx, { agentId, status }) => {
    return await ctx.db
      .query("connectionRequests")
      .withIndex("by_agent_and_status", (q) =>
        q.eq("agentId", agentId).eq("status", status)
      )
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    agentId: v.id("agents"),
    personId: v.id("people"),
    companyId: v.id("companies"),
    contactRole: v.string(),
    contactType: contactTypeValidator,
    sentDate: v.number(),
    status: connectionStatusValidator,
    noteWithRequest: v.boolean(),
    messageSent: v.boolean(),
    messageDate: v.optional(v.number()),
    linkedToLeadId: v.optional(v.id("agentItems")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePerson(ctx);
    return await ctx.db.insert("connectionRequests", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    requestId: v.id("connectionRequests"),
    status: connectionStatusValidator,
  },
  handler: async (ctx, { requestId, status }) => {
    await requirePerson(ctx);
    await ctx.db.patch(requestId, { status, updatedAt: Date.now() });
  },
});

export const markMessageSent = mutation({
  args: {
    requestId: v.id("connectionRequests"),
  },
  handler: async (ctx, { requestId }) => {
    await requirePerson(ctx);
    await ctx.db.patch(requestId, {
      messageSent: true,
      messageDate: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    requestId: v.id("connectionRequests"),
    contactRole: v.optional(v.string()),
    contactType: v.optional(contactTypeValidator),
    noteWithRequest: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    linkedToLeadId: v.optional(v.id("agentItems")),
  },
  handler: async (ctx, { requestId, ...fields }) => {
    await requirePerson(ctx);
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(requestId, updates);
  },
});
