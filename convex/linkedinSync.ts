import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const contactTypeValidator = v.union(
  v.literal("recruiter"),
  v.literal("hiring_manager"),
  v.literal("peer"),
  v.literal("founder"),
  v.literal("executive"),
  v.literal("other")
);

const tierValidator = v.union(
  v.literal("tier1"),
  v.literal("tier2"),
  v.literal("tier3")
);

/**
 * Find or create an outreach company + contact in one call.
 * Used by the linkedin-sync skill (no auth needed).
 */
export const ensureOutreachContact = internalMutation({
  args: {
    userId: v.string(),
    companyName: v.string(),
    companyDomain: v.optional(v.string()),
    contactName: v.string(),
    contactTitle: v.optional(v.string()),
    contactLinkedinUrl: v.optional(v.string()),
    contactHeadline: v.optional(v.string()),
    contactType: contactTypeValidator,
    tier: v.optional(tierValidator),
  },
  handler: async (ctx, args) => {
    // 1. Find or create outreach company
    let company = args.companyDomain
      ? await ctx.db
          .query("outreachCompanies")
          .withIndex("by_user_and_domain", (q) =>
            q.eq("userId", args.userId).eq("domain", args.companyDomain)
          )
          .first()
      : null;

    // Fallback: search by name
    if (!company) {
      const allCompanies = await ctx.db
        .query("outreachCompanies")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      company = allCompanies.find(
        (c) => c.name.toLowerCase() === args.companyName.toLowerCase()
      ) ?? null;
    }

    const companyId =
      company?._id ??
      (await ctx.db.insert("outreachCompanies", {
        name: args.companyName,
        domain: args.companyDomain,
        logoUrl: args.companyDomain
          ? `https://logo.clearbit.com/${args.companyDomain}`
          : undefined,
        isYcBacked: false,
        userId: args.userId,
        status: "active",
        updatedAt: Date.now(),
      }));

    // 2. Find or create outreach contact
    // GLOBAL uniqueness check by LinkedIn URL (across ALL companies)
    if (args.contactLinkedinUrl) {
      // Normalize URL: strip trailing slash for consistent matching
      const normalizedUrl = args.contactLinkedinUrl.replace(/\/$/, "");
      const withSlash = normalizedUrl + "/";

      const byUrl = await ctx.db
        .query("outreachContacts")
        .withIndex("by_linkedin_url", (q) =>
          q.eq("linkedinUrl", args.contactLinkedinUrl)
        )
        .first();
      // Also check normalized variants (with/without trailing slash)
      const byNormalized = byUrl
        ? byUrl
        : await ctx.db
            .query("outreachContacts")
            .withIndex("by_linkedin_url", (q) =>
              q.eq("linkedinUrl", normalizedUrl)
            )
            .first();
      const existing = byNormalized
        ? byNormalized
        : await ctx.db
            .query("outreachContacts")
            .withIndex("by_linkedin_url", (q) =>
              q.eq("linkedinUrl", withSlash)
            )
            .first();

      if (existing) {
        // Update company if the existing record is under "Unknown"
        const existingCompany = await ctx.db.get(existing.companyId);
        if (
          existingCompany &&
          existingCompany.name === "Unknown" &&
          args.companyName !== "Unknown"
        ) {
          await ctx.db.patch(existing._id, {
            companyId,
            title: args.contactTitle ?? existing.title,
            headline: args.contactHeadline ?? existing.headline,
            updatedAt: Date.now(),
          });
          return { companyId, contactId: existing._id, created: false };
        }
        return { companyId: existing.companyId, contactId: existing._id, created: false };
      }
    }

    // Also check by name within company
    const contactsByCompany = await ctx.db
      .query("outreachContacts")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
    const nameMatch = contactsByCompany.find(
      (c) => c.name.toLowerCase() === args.contactName.toLowerCase()
    );
    if (nameMatch) {
      // Update LinkedIn URL if missing
      if (args.contactLinkedinUrl && !nameMatch.linkedinUrl) {
        await ctx.db.patch(nameMatch._id, {
          linkedinUrl: args.contactLinkedinUrl,
          updatedAt: Date.now(),
        });
      }
      return { companyId, contactId: nameMatch._id, created: false };
    }

    const contactId = await ctx.db.insert("outreachContacts", {
      companyId,
      name: args.contactName,
      title: args.contactTitle,
      linkedinUrl: args.contactLinkedinUrl,
      headline: args.contactHeadline,
      source: "linkedin",
      tier: args.tier,
      updatedAt: Date.now(),
    });

    return { companyId, contactId, created: true };
  },
});

/**
 * List all outreach contacts with their company info.
 * Used by sync skill to match LinkedIn names to CRM records.
 */
export const listAllContacts = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const companies = await ctx.db
      .query("outreachCompanies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const companyMap = new Map(companies.map((c) => [c._id, c]));

    const results = [];
    for (const company of companies) {
      const contacts = await ctx.db
        .query("outreachContacts")
        .withIndex("by_company", (q) => q.eq("companyId", company._id))
        .collect();
      for (const c of contacts) {
        results.push({
          contactId: c._id,
          companyId: c.companyId,
          name: c.name,
          linkedinUrl: c.linkedinUrl,
          companyName: company.name,
        });
      }
    }
    return results;
  },
});

/**
 * Check if a message already exists (dedup).
 */
export const messageExists = internalQuery({
  args: {
    contactId: v.id("outreachContacts"),
    body: v.string(),
    sentAt: v.number(),
  },
  handler: async (ctx, { contactId, body, sentAt }) => {
    const messages = await ctx.db
      .query("outreachMessages")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .collect();

    const DAY_MS = 24 * 60 * 60 * 1000;
    return messages.some(
      (m) =>
        m.body === body &&
        Math.abs(m.sentAt - sentAt) < DAY_MS
    );
  },
});

/**
 * Delete an outreach contact and its messages.
 * Used by linkedin-sync cleanup to remove old records.
 */
export const deleteOutreachContact = internalMutation({
  args: { contactId: v.id("outreachContacts") },
  handler: async (ctx, { contactId }) => {
    // Delete all messages for this contact
    const messages = await ctx.db
      .query("outreachMessages")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .collect();
    for (const m of messages) {
      await ctx.db.delete(m._id);
    }
    // Delete the contact
    await ctx.db.delete(contactId);
  },
});

/**
 * Delete an outreach company if it has no remaining contacts.
 */
export const deleteOrphanCompany = internalMutation({
  args: { companyId: v.id("outreachCompanies") },
  handler: async (ctx, { companyId }) => {
    const contacts = await ctx.db
      .query("outreachContacts")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
    if (contacts.length === 0) {
      await ctx.db.delete(companyId);
      return { deleted: true };
    }
    return { deleted: false, remaining: contacts.length };
  },
});

/**
 * Delete a connection request by person LinkedIn URL.
 */
export const deleteConnectionRequest = internalMutation({
  args: { personLinkedinUrl: v.string() },
  handler: async (ctx, { personLinkedinUrl }) => {
    const person = await ctx.db
      .query("people")
      .withIndex("by_linkedin", (q) => q.eq("linkedinUrl", personLinkedinUrl))
      .first();
    if (!person) return { deleted: 0 };

    const requests = await ctx.db
      .query("connectionRequests")
      .filter((q) => q.eq(q.field("personId"), person._id))
      .collect();
    // Only delete pending requests (from invitation sync)
    const pending = requests.filter((r) => r.status === "pending");
    for (const r of pending) {
      await ctx.db.delete(r._id);
    }
    return { deleted: pending.length };
  },
});
