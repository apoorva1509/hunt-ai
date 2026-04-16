import { mutation, query, action, internalMutation } from "./_generated/server";
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
    const userId = person.clerkTokenIdentifier!;

    // Dedup: if a company with the same domain already exists for this user, return it
    if (args.domain) {
      const existingByDomain = await ctx.db
        .query("outreachCompanies")
        .withIndex("by_user_and_domain", (q) =>
          q.eq("userId", userId).eq("domain", args.domain)
        )
        .first();
      if (existingByDomain) return existingByDomain._id;
    }

    // Dedup: if a company with the same name (case-insensitive) exists, return it
    const allUserCompanies = await ctx.db
      .query("outreachCompanies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const existingByName = allUserCompanies.find(
      (c) => c.name.toLowerCase() === args.name.toLowerCase()
    );
    if (existingByName) return existingByName._id;

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
      userId,
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
    const jobs = await ctx.db
      .query("outreachJobs")
      .withIndex("by_company", (q) => q.eq("companyId", id))
      .collect();
    for (const job of jobs) await ctx.db.delete(job._id);
    const reminders = await ctx.db
      .query("followUpReminders")
      .withIndex("by_company", (q) => q.eq("companyId", id))
      .collect();
    for (const r of reminders) await ctx.db.delete(r._id);
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

export const listWithStats = query({
  args: {},
  handler: async (ctx) => {
    const person = await getCurrentPerson(ctx);
    if (!person) return [];
    const userId = person.clerkTokenIdentifier!;
    const companies = await ctx.db
      .query("outreachCompanies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return await Promise.all(
      companies.map(async (company) => {
        const contacts = await ctx.db
          .query("outreachContacts")
          .withIndex("by_company", (q) => q.eq("companyId", company._id))
          .collect();

        let outboundDMCount = 0;
        let inboundCount = 0;
        let totalMessages = 0;
        let latestMessageAt: number | null = null;

        for (const contact of contacts) {
          const messages = await ctx.db
            .query("outreachMessages")
            .withIndex("by_contact", (q) => q.eq("contactId", contact._id))
            .collect();
          for (const m of messages) {
            totalMessages++;
            if (m.direction === "outbound") outboundDMCount++;
            if (m.direction === "inbound") inboundCount++;
            if (m.sentAt && (latestMessageAt === null || m.sentAt > latestMessageAt)) {
              latestMessageAt = m.sentAt;
            }
          }
        }

        const jobs = await ctx.db
          .query("outreachJobs")
          .withIndex("by_company", (q) => q.eq("companyId", company._id))
          .collect();
        const appliedJobCount = jobs.filter((j) => j.status === "applied").length;

        return {
          ...company,
          stats: {
            contactCount: contacts.length,
            outboundDMCount,
            inboundCount,
            totalMessages,
            appliedJobCount,
            hasResume: !!company.resumeStorageId,
            latestMessageAt,
          },
        };
      })
    );
  },
});

export const listWithResumes = query({
  args: {},
  handler: async (ctx) => {
    const person = await getCurrentPerson(ctx);
    if (!person) return [];
    const userId = person.clerkTokenIdentifier!;
    const companies = await ctx.db
      .query("outreachCompanies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const withResumes = companies.filter((c) => c.resumeStorageId);
    return await Promise.all(
      withResumes.map(async (c) => ({
        _id: c._id,
        name: c.name,
        roleAppliedFor: c.roleAppliedFor,
        resumeFileName: c.resumeFileName,
        resumeUrl: c.resumeStorageId
          ? await ctx.storage.getUrl(c.resumeStorageId)
          : null,
      }))
    );
  },
});

export const generateResumeUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePerson(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const linkResume = mutation({
  args: {
    id: v.id("outreachCompanies"),
    storageId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, { id, storageId, fileName }) => {
    await requirePerson(ctx);
    await ctx.db.patch(id, {
      resumeStorageId: storageId,
      resumeFileName: fileName,
      updatedAt: Date.now(),
    });
  },
});

export const getResumeUrl = query({
  args: { id: v.id("outreachCompanies") },
  handler: async (ctx, { id }) => {
    const company = await ctx.db.get(id);
    if (!company?.resumeStorageId) return null;
    return await ctx.storage.getUrl(company.resumeStorageId);
  },
});

export const removeResume = mutation({
  args: { id: v.id("outreachCompanies") },
  handler: async (ctx, { id }) => {
    await requirePerson(ctx);
    const company = await ctx.db.get(id);
    if (company?.resumeStorageId) {
      await ctx.storage.delete(company.resumeStorageId);
    }
    await ctx.db.patch(id, {
      resumeStorageId: undefined,
      resumeFileName: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const linkResumeInternal = internalMutation({
  args: {
    id: v.id("outreachCompanies"),
    storageId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, { id, storageId, fileName }) => {
    await ctx.db.patch(id, {
      resumeStorageId: storageId,
      resumeFileName: fileName,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Merge a duplicate company into a primary company, moving all related records.
 * The duplicate is deleted after merging.
 */
export const mergeCompanies = internalMutation({
  args: {
    keepId: v.id("outreachCompanies"),
    deleteId: v.id("outreachCompanies"),
  },
  handler: async (ctx, { keepId, deleteId }) => {
    const keep = await ctx.db.get(keepId);
    const dup = await ctx.db.get(deleteId);
    if (!keep || !dup) throw new Error("Company not found");

    const now = Date.now();

    // Move contacts
    const contacts = await ctx.db
      .query("outreachContacts")
      .withIndex("by_company", (q) => q.eq("companyId", deleteId))
      .collect();
    for (const c of contacts) {
      await ctx.db.patch(c._id, { companyId: keepId, updatedAt: now });
    }

    // Move messages
    const messages = await ctx.db
      .query("outreachMessages")
      .withIndex("by_company", (q) => q.eq("companyId", deleteId))
      .collect();
    for (const m of messages) {
      await ctx.db.patch(m._id, { companyId: keepId, updatedAt: now });
    }

    // Move steps
    const steps = await ctx.db
      .query("outreachSteps")
      .withIndex("by_company", (q) => q.eq("companyId", deleteId))
      .collect();
    for (const s of steps) {
      await ctx.db.patch(s._id, { companyId: keepId, updatedAt: now });
    }

    // Move jobs
    const jobs = await ctx.db
      .query("outreachJobs")
      .withIndex("by_company", (q) => q.eq("companyId", deleteId))
      .collect();
    for (const j of jobs) {
      await ctx.db.patch(j._id, { companyId: keepId, updatedAt: now });
    }

    // Move follow-up reminders
    const reminders = await ctx.db
      .query("followUpReminders")
      .withIndex("by_company", (q) => q.eq("companyId", deleteId))
      .collect();
    for (const r of reminders) {
      await ctx.db.patch(r._id, { companyId: keepId, updatedAt: now });
    }

    // Delete the duplicate
    await ctx.db.delete(deleteId);

    return {
      merged: dup.name,
      into: keep.name,
      movedContacts: contacts.length,
      movedMessages: messages.length,
      movedSteps: steps.length,
      movedJobs: jobs.length,
    };
  },
});

// Internal: patch company fields without auth (used by CLI/agent for backfills).
export const patchInternal = internalMutation({
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
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(id, patch);
  },
});

// Internal: create company without auth (used by CLI/agent)
export const createInternal = internalMutation({
  args: {
    name: v.string(),
    domain: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    isYcBacked: v.boolean(),
    fundingStage: v.optional(v.string()),
    description: v.optional(v.string()),
    userId: v.string(),
    status: v.optional(statusValidator),
    roleAppliedFor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
      userId: args.userId,
      status: args.status ?? "active",
      roleAppliedFor: args.roleAppliedFor,
      updatedAt: now,
    });
  },
});
