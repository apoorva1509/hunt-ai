import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const get = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("linkedinSyncState")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

/** Find the first person with a clerkTokenIdentifier (for CLI sync). */
export const findUserId = internalQuery({
  args: {},
  handler: async (ctx) => {
    const people = await ctx.db.query("people").collect();
    const withClerk = people.find((p) => p.clerkTokenIdentifier);
    return withClerk?.clerkTokenIdentifier ?? null;
  },
});

/** List all people for dedup analysis. */
export const listPeople = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("people").collect();
  },
});

/** Delete a person by ID. */
export const deletePerson = internalMutation({
  args: { personId: v.id("people") },
  handler: async (ctx, { personId }) => {
    // Delete associated personCompanyLinks
    const links = await ctx.db
      .query("personCompanyLinks")
      .withIndex("by_person_and_company", (q) => q.eq("personId", personId))
      .collect();
    for (const link of links) {
      await ctx.db.delete(link._id);
    }
    // Delete associated connectionRequests
    const requests = await ctx.db
      .query("connectionRequests")
      .filter((q) => q.eq(q.field("personId"), personId))
      .collect();
    for (const req of requests) {
      await ctx.db.delete(req._id);
    }
    await ctx.db.delete(personId);
  },
});

export const upsert = internalMutation({
  args: {
    userId: v.string(),
    lastRunAt: v.number(),
    lastConnectionName: v.optional(v.string()),
    lastConnectionDate: v.optional(v.string()),
    totalConnectionsSynced: v.number(),
    lastInvitationName: v.optional(v.string()),
    totalInvitationsSynced: v.number(),
    lastMessageContactName: v.optional(v.string()),
    lastMessageBody: v.optional(v.string()),
    lastMessageTimestamp: v.optional(v.number()),
    totalMessagesSynced: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("linkedinSyncState")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const data = { ...args, updatedAt: Date.now() };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return await ctx.db.insert("linkedinSyncState", data);
  },
});
