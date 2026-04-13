import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const ensurePerson = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");

    const { tokenIdentifier, email, name, pictureUrl } = identity;

    // 1. Try by clerk token
    const byToken = await ctx.db
      .query("people")
      .withIndex("by_clerk_token", (q) =>
        q.eq("clerkTokenIdentifier", tokenIdentifier)
      )
      .first();
    if (byToken) return byToken._id;

    // 2. Try by email (merge pre-seeded record)
    if (email) {
      const byEmail = await ctx.db
        .query("people")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (byEmail) {
        await ctx.db.patch(byEmail._id, {
          clerkTokenIdentifier: tokenIdentifier,
          name: name ?? byEmail.name,
          pictureUrl: pictureUrl ?? byEmail.pictureUrl,
          source: "clerk_signup" as const,
          updatedAt: Date.now(),
        });
        return byEmail._id;
      }
    }

    // 3. Create new
    return await ctx.db.insert("people", {
      clerkTokenIdentifier: tokenIdentifier,
      email: email ?? undefined,
      name: name ?? undefined,
      pictureUrl: pictureUrl ?? undefined,
      source: "clerk_signup",
      updatedAt: Date.now(),
    });
  },
});

export const getMyPerson = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("people")
      .withIndex("by_clerk_token", (q) =>
        q.eq("clerkTokenIdentifier", identity.tokenIdentifier)
      )
      .first();
  },
});

export const findOrCreate = mutation({
  args: {
    name: v.string(),
    linkedinUrl: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { name, linkedinUrl, email }) => {
    // Try to find by LinkedIn URL first
    if (linkedinUrl) {
      const existing = await ctx.db
        .query("people")
        .withIndex("by_linkedin", (q) => q.eq("linkedinUrl", linkedinUrl))
        .first();
      if (existing) return existing._id;
    }

    // Try to find by email
    if (email) {
      const existing = await ctx.db
        .query("people")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (existing) return existing._id;
    }

    // Create new person
    return await ctx.db.insert("people", {
      name,
      linkedinUrl,
      email,
      source: "manual",
      updatedAt: Date.now(),
    });
  },
});

export const getById = query({
  args: { personId: v.id("people") },
  handler: async (ctx, { personId }) => {
    return await ctx.db.get(personId);
  },
});

export const getByIds = query({
  args: { personIds: v.array(v.id("people")) },
  handler: async (ctx, { personIds }) => {
    const results = [];
    for (const id of personIds) {
      const person = await ctx.db.get(id);
      if (person) results.push(person);
    }
    return results;
  },
});
