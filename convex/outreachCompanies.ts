import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { requirePerson, getCurrentPerson } from "./helpers/auth";
import { api, internal } from "./_generated/api";

const statusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("closed")
);

export const list = query({
  args: {},
  handler: async (ctx) => {
    const person = await getCurrentPerson(ctx);
    if (!person) return [];
    const userId = person.clerkTokenIdentifier!;
    return await ctx.db
      .query("outreachCompanies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const listByStatus = query({
  args: { userId: v.string(), status: statusValidator },
  handler: async (ctx, { userId, status }) => {
    return await ctx.db
      .query("outreachCompanies")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", userId).eq("status", status)
      )
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("outreachCompanies") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    domain: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    isYcBacked: v.boolean(),
    fundingStage: v.optional(v.string()),
    description: v.optional(v.string()),
    roleAppliedFor: v.optional(v.string()),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    const person = await requirePerson(ctx);
    const now = Date.now();
    return await ctx.db.insert("outreachCompanies", {
      name: args.name,
      domain: args.domain,
      logoUrl: args.logoUrl,
      linkedinUrl: args.linkedinUrl,
      websiteUrl: args.websiteUrl,
      isYcBacked: args.isYcBacked,
      fundingStage: args.fundingStage,
      description: args.description,
      userId: person.clerkTokenIdentifier!,
      status: args.status ?? "active",
      roleAppliedFor: args.roleAppliedFor,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("outreachCompanies"),
    name: v.optional(v.string()),
    domain: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    isYcBacked: v.optional(v.boolean()),
    fundingStage: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(statusValidator),
    roleAppliedFor: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requirePerson(ctx);
    const patch: Record<string, any> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(id, patch);

    // Auto-stop follow-ups for all contacts when company is closed
    if (fields.status === "closed") {
      const contacts = await ctx.db
        .query("outreachContacts")
        .withIndex("by_company", (q) => q.eq("companyId", id))
        .collect();
      const now = Date.now();
      for (const contact of contacts) {
        if (contact.followUpEnabled !== false) {
          await ctx.db.patch(contact._id, {
            followUpEnabled: false,
            followUpStoppedReason: "closed",
            updatedAt: now,
          });
          await ctx.scheduler.runAfter(
            0,
            internal.followUpReminders.dismissAllForContact,
            { contactId: contact._id }
          );
        }
      }
    }
  },
});

export const remove = mutation({
  args: { id: v.id("outreachCompanies") },
  handler: async (ctx, { id }) => {
    await requirePerson(ctx);
    const contacts = await ctx.db
      .query("outreachContacts")
      .withIndex("by_company", (q) => q.eq("companyId", id))
      .collect();
    for (const contact of contacts) {
      const messages = await ctx.db
        .query("outreachMessages")
        .withIndex("by_contact", (q) => q.eq("contactId", contact._id))
        .collect();
      for (const msg of messages) await ctx.db.delete(msg._id);
      const guidance = await ctx.db
        .query("outreachGuidance")
        .withIndex("by_contact", (q) => q.eq("contactId", contact._id))
        .collect();
      for (const g of guidance) await ctx.db.delete(g._id);
      await ctx.db.delete(contact._id);
    }
    const steps = await ctx.db
      .query("outreachSteps")
      .withIndex("by_company", (q) => q.eq("companyId", id))
      .collect();
    for (const step of steps) await ctx.db.delete(step._id);
    await ctx.db.delete(id);
  },
});

export const addCompanyWithEnrichment = action({
  args: {
    name: v.string(),
    websiteUrl: v.optional(v.string()),
    roleAppliedFor: v.optional(v.string()),
  },
  handler: async (ctx, { name, websiteUrl, roleAppliedFor }): Promise<{ companyId: string; isYcBacked: boolean }> => {
    let domain: string | undefined;
    if (websiteUrl) {
      try {
        domain = new URL(
          websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`
        ).hostname.replace("www.", "");
      } catch {
        domain = undefined;
      }
    }

    let logoUrl: string | undefined;
    if (domain) {
      logoUrl = `https://logo.clearbit.com/${domain}`;
    }

    let isYcBacked = false;
    try {
      const res = await fetch(
        `https://www.ycombinator.com/companies?q=${encodeURIComponent(name)}`
      );
      if (res.ok) {
        const html = await res.text();
        isYcBacked = html.toLowerCase().includes(name.toLowerCase());
      }
    } catch {
      // YC check failed
    }

    const companyId = await ctx.runMutation(api.outreachCompanies.create, {
      name,
      domain,
      logoUrl,
      websiteUrl,
      isYcBacked,
      roleAppliedFor,
    });

    if (isYcBacked) {
      await ctx.runMutation(api.outreachSteps.create, {
        companyId,
        label: "Apply via YC Work at a Startup portal",
        status: "pending",
        order: 0,
        isAutoGenerated: true,
      });
    }

    return { companyId, isYcBacked };
  },
});
