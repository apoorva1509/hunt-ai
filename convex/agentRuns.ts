import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const startRun = mutation({
  args: {
    agentId: v.id("agents"),
    triggeredBy: v.union(
      v.literal("schedule"),
      v.literal("manual"),
      v.literal("webhook")
    ),
  },
  handler: async (ctx, { agentId, triggeredBy }) => {
    return await ctx.db.insert("agentRuns", {
      agentId,
      status: "running",
      triggeredBy,
      startedAt: Date.now(),
    });
  },
});

export const finishRun = mutation({
  args: {
    runId: v.id("agentRuns"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { runId, status, summary, error }) => {
    await ctx.db.patch(runId, {
      status,
      completedAt: Date.now(),
      summary,
      error,
    });
  },
});

export const cancelRun = mutation({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run) return;
    if (run.status === "pending" || run.status === "running") {
      await ctx.db.patch(runId, {
        status: "failed",
        completedAt: Date.now(),
        error: "Cancelled by user",
      });
    }
  },
});

export const deleteRun = mutation({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, { runId }) => {
    await ctx.db.delete(runId);
  },
});

export const getPendingRuns = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("agentRuns")
      .filter((q) => q.eq(q.field("status"), "pending"))
      .take(5);
  },
});

export const claimRun = mutation({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run || run.status !== "pending") return null;
    await ctx.db.patch(runId, {
      status: "running",
      startedAt: Date.now(),
    });
    return run;
  },
});

export const getAgentRuns = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    return await ctx.db
      .query("agentRuns")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .order("desc")
      .take(20);
  },
});

export const getLatestRun = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    return await ctx.db
      .query("agentRuns")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .order("desc")
      .first();
  },
});
