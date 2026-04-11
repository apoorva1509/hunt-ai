import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePerson } from "./helpers/auth";

const trackerStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("evaluated"),
  v.literal("failed"),
  v.literal("skipped")
);

export const list = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    return await ctx.db
      .query("trackerUrls")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .order("desc")
      .take(200);
  },
});

export const listByStatus = query({
  args: { agentId: v.id("agents"), status: trackerStatusValidator },
  handler: async (ctx, { agentId, status }) => {
    return await ctx.db
      .query("trackerUrls")
      .withIndex("by_agent_and_status", (q) =>
        q.eq("agentId", agentId).eq("status", status)
      )
      .order("desc")
      .take(200);
  },
});

export const addUrls = mutation({
  args: {
    agentId: v.id("agents"),
    urls: v.array(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { agentId, urls, notes }) => {
    await requirePerson(ctx);
    const now = Date.now();
    const ids = [];
    for (const url of urls) {
      const trimmed = url.trim();
      if (!trimmed) continue;
      // Dedup: skip if URL already exists for this agent
      const existing = await ctx.db
        .query("trackerUrls")
        .withIndex("by_url", (q) => q.eq("url", trimmed))
        .first();
      if (existing && existing.agentId === agentId) continue;

      const id = await ctx.db.insert("trackerUrls", {
        agentId,
        url: trimmed,
        status: "pending",
        notes: notes ?? undefined,
        addedAt: now,
        updatedAt: now,
      });
      ids.push(id);
    }
    return ids;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("trackerUrls"),
    status: trackerStatusValidator,
    error: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, error }) => {
    await requirePerson(ctx);
    const patch: Record<string, any> = { status, updatedAt: Date.now() };
    if (status === "evaluated" || status === "failed") {
      patch.processedAt = Date.now();
    }
    if (error !== undefined) patch.error = error;
    await ctx.db.patch(id, patch);
  },
});

export const updateResult = mutation({
  args: {
    id: v.id("trackerUrls"),
    title: v.optional(v.string()),
    company: v.optional(v.string()),
    score: v.optional(v.number()),
    archetype: v.optional(v.string()),
    location: v.optional(v.string()),
    workMode: v.optional(v.string()),
    salary: v.optional(v.string()),
    reportPath: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const patch: Record<string, any> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(id, patch);
  },
});

export const updateNotes = mutation({
  args: { id: v.id("trackerUrls"), notes: v.string() },
  handler: async (ctx, { id, notes }) => {
    await requirePerson(ctx);
    await ctx.db.patch(id, { notes, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("trackerUrls") },
  handler: async (ctx, { id }) => {
    await requirePerson(ctx);
    await ctx.db.delete(id);
  },
});

// ── Runner-facing functions (no auth — called by runner process) ──

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("trackerUrls")
      .filter((q) => q.eq(q.field("status"), "pending"))
      .order("asc")
      .take(10);
  },
});

export const markProcessing = mutation({
  args: { id: v.id("trackerUrls") },
  handler: async (ctx, { id }) => {
    const item = await ctx.db.get(id);
    if (!item || item.status !== "pending") return null;
    await ctx.db.patch(id, { status: "processing", updatedAt: Date.now() });
    return item;
  },
});

export const markEvaluated = mutation({
  args: {
    id: v.id("trackerUrls"),
    title: v.optional(v.string()),
    company: v.optional(v.string()),
    score: v.optional(v.number()),
    archetype: v.optional(v.string()),
    location: v.optional(v.string()),
    workMode: v.optional(v.string()),
    salary: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const patch: Record<string, any> = {
      status: "evaluated",
      processedAt: Date.now(),
      updatedAt: Date.now(),
    };
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(id, patch);
  },
});

export const markFailed = mutation({
  args: {
    id: v.id("trackerUrls"),
    error: v.string(),
  },
  handler: async (ctx, { id, error }) => {
    await ctx.db.patch(id, {
      status: "failed",
      error,
      processedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
