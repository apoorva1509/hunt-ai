import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePerson } from "./helpers/auth";

const candidateValidator = v.object({
  name: v.string(),
  title: v.string(),
  headline: v.string(),
  linkedinUrl: v.string(),
  email: v.optional(v.string()),
  photoUrl: v.optional(v.string()),
  priority: v.number(),
  tier: v.union(v.literal("tier1"), v.literal("tier2"), v.literal("tier3")),
  message: v.string(),
  dmMessage: v.string(),
  status: v.string(),
  mode: v.union(v.literal("connection"), v.literal("dm")),
});

// ── List all research sessions for current user ─────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    const person = await requirePerson(ctx);
    return await ctx.db
      .query("connectResearch")
      .withIndex("by_user", (q) => q.eq("userId", person.clerkTokenIdentifier!))
      .order("desc")
      .collect();
  },
});

// ── Get a single research session ───────────────────────────

export const get = query({
  args: { id: v.id("connectResearch") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// ── Save a new research session (or update existing for same company+role) ──

export const save = mutation({
  args: {
    companyLinkedinUrl: v.string(),
    companyName: v.string(),
    companyDomain: v.optional(v.string()),
    companyIndustry: v.optional(v.string()),
    companyDescription: v.optional(v.string()),
    companyLogoUrl: v.optional(v.string()),
    role: v.string(),
    candidates: v.array(candidateValidator),
  },
  handler: async (ctx, args) => {
    const person = await requirePerson(ctx);
    const userId = person.clerkTokenIdentifier!;
    const now = Date.now();

    // Check if research already exists for this company
    const existing = await ctx.db
      .query("connectResearch")
      .withIndex("by_user_and_company", (q) =>
        q.eq("userId", userId).eq("companyLinkedinUrl", args.companyLinkedinUrl)
      )
      .first();

    if (existing) {
      // Merge: keep existing candidates that aren't in new results, add new ones
      const existingUrls = new Set(existing.candidates.map((c) => c.linkedinUrl));
      const newUrls = new Set(args.candidates.map((c) => c.linkedinUrl));

      // Keep existing candidates not in new search + add all new candidates
      const merged = [
        ...existing.candidates.filter((c) => !newUrls.has(c.linkedinUrl)),
        ...args.candidates,
      ];

      await ctx.db.patch(existing._id, {
        companyName: args.companyName,
        companyDomain: args.companyDomain,
        companyIndustry: args.companyIndustry,
        companyDescription: args.companyDescription,
        companyLogoUrl: args.companyLogoUrl,
        role: args.role,
        candidates: merged,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("connectResearch", {
      userId,
      companyLinkedinUrl: args.companyLinkedinUrl,
      companyName: args.companyName,
      companyDomain: args.companyDomain,
      companyIndustry: args.companyIndustry,
      companyDescription: args.companyDescription,
      companyLogoUrl: args.companyLogoUrl,
      role: args.role,
      candidates: args.candidates,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ── Update a single candidate's status/message in a session ─

export const updateCandidate = mutation({
  args: {
    sessionId: v.id("connectResearch"),
    linkedinUrl: v.string(),
    updates: v.object({
      status: v.optional(v.string()),
      mode: v.optional(v.union(v.literal("connection"), v.literal("dm"))),
      message: v.optional(v.string()),
      dmMessage: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { sessionId, linkedinUrl, updates }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return;

    const candidates = session.candidates.map((c) => {
      if (c.linkedinUrl !== linkedinUrl) return c;
      return {
        ...c,
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.mode !== undefined ? { mode: updates.mode } : {}),
        ...(updates.message !== undefined ? { message: updates.message } : {}),
        ...(updates.dmMessage !== undefined ? { dmMessage: updates.dmMessage } : {}),
      };
    });

    await ctx.db.patch(sessionId, { candidates, updatedAt: Date.now() });
  },
});

// ── Remove candidates that were sent (moved to tracker) ─────

export const removeCandidates = mutation({
  args: {
    sessionId: v.id("connectResearch"),
    linkedinUrls: v.array(v.string()),
  },
  handler: async (ctx, { sessionId, linkedinUrls }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return;

    const urlSet = new Set(linkedinUrls);
    const remaining = session.candidates.filter((c) => !urlSet.has(c.linkedinUrl));

    if (remaining.length === 0) {
      // All candidates moved to tracker — delete the session
      await ctx.db.delete(sessionId);
    } else {
      await ctx.db.patch(sessionId, { candidates: remaining, updatedAt: Date.now() });
    }
  },
});

// ── Delete an entire research session ───────────────────────

export const remove = mutation({
  args: { id: v.id("connectResearch") },
  handler: async (ctx, { id }) => {
    await requirePerson(ctx);
    await ctx.db.delete(id);
  },
});
