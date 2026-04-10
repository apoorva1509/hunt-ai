import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getMyCompany = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("companies")
      .withIndex("by_clerk_user", (q) =>
        q.eq("clerkUserId", identity.subject)
      )
      .first();
  },
});

export const saveCompany = mutation({
  args: {
    domain: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    iconUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    foundedYear: v.optional(v.number()),
    employees: v.optional(v.number()),
    industries: v.optional(v.array(v.string())),
    socialLinks: v.optional(
      v.array(v.object({ name: v.string(), url: v.string() }))
    ),
    brandfetchId: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");

    const existing = await ctx.db
      .query("companies")
      .withIndex("by_clerk_user", (q) =>
        q.eq("clerkUserId", identity.subject)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, clerkUserId: identity.subject });
      return existing._id;
    }

    return await ctx.db.insert("companies", {
      ...args,
      clerkUserId: identity.subject,
    });
  },
});
