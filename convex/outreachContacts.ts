import { mutation, query, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requirePerson } from "./helpers/auth";
import { api, internal } from "./_generated/api";

export const listByCompany = query({
  args: { companyId: v.id("outreachCompanies") },
  handler: async (ctx, { companyId }) => {
    return await ctx.db
      .query("outreachContacts")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("outreachContacts") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    companyId: v.id("outreachCompanies"),
    name: v.string(),
    title: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    headline: v.optional(v.string()),
    source: v.union(
      v.literal("manual"),
      v.literal("apollo"),
      v.literal("linkedin")
    ),
    apolloData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requirePerson(ctx);
    return await ctx.db.insert("outreachContacts", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("outreachContacts"),
    name: v.optional(v.string()),
    title: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    headline: v.optional(v.string()),
    followUpEnabled: v.optional(v.boolean()),
    followUpStoppedReason: v.optional(
      v.union(
        v.literal("manual"),
        v.literal("replied"),
        v.literal("closed")
      )
    ),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requirePerson(ctx);
    const patch: Record<string, any> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(id, patch);
  },
});

export const stopFollowUp = mutation({
  args: {
    id: v.id("outreachContacts"),
    reason: v.union(
      v.literal("manual"),
      v.literal("replied"),
      v.literal("closed")
    ),
  },
  handler: async (ctx, { id, reason }) => {
    await requirePerson(ctx);
    await ctx.db.patch(id, {
      followUpEnabled: false,
      followUpStoppedReason: reason,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      0,
      internal.followUpReminders.dismissAllForContact,
      { contactId: id }
    );
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("outreachContacts").collect();
  },
});

export const createFromResearch = internalMutation({
  args: {
    companyId: v.id("outreachCompanies"),
    name: v.string(),
    title: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    headline: v.optional(v.string()),
    source: v.union(v.literal("manual"), v.literal("apollo"), v.literal("linkedin")),
    tier: v.optional(v.union(v.literal("tier1"), v.literal("tier2"), v.literal("tier3"))),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outreachContacts", { ...args, updatedAt: Date.now() });
  },
});

export const patchInternal = internalMutation({
  args: {
    id: v.id("outreachContacts"),
    title: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    headline: v.optional(v.string()),
    tier: v.optional(v.union(v.literal("tier1"), v.literal("tier2"), v.literal("tier3"))),
    followUpEnabled: v.optional(v.boolean()),
    followUpStoppedReason: v.optional(
      v.union(v.literal("manual"), v.literal("replied"), v.literal("closed"))
    ),
  },
  handler: async (ctx, { id, ...fields }) => {
    const patch: Record<string, any> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(id, patch);
  },
});

export const deleteInternal = internalMutation({
  args: { id: v.id("outreachContacts") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const setLinkedinUrl = internalMutation({
  args: {
    id: v.id("outreachContacts"),
    linkedinUrl: v.string(),
  },
  handler: async (ctx, { id, linkedinUrl }) => {
    await ctx.db.patch(id, { linkedinUrl, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("outreachContacts") },
  handler: async (ctx, { id }) => {
    await requirePerson(ctx);
    const messages = await ctx.db
      .query("outreachMessages")
      .withIndex("by_contact", (q) => q.eq("contactId", id))
      .collect();
    for (const msg of messages) await ctx.db.delete(msg._id);
    const guidance = await ctx.db
      .query("outreachGuidance")
      .withIndex("by_contact", (q) => q.eq("contactId", id))
      .collect();
    for (const g of guidance) await ctx.db.delete(g._id);
    await ctx.db.delete(id);
  },
});

export const enrichFromLinkedin = action({
  args: {
    companyId: v.id("outreachCompanies"),
    linkedinUrl: v.string(),
  },
  handler: async (ctx, { companyId, linkedinUrl }): Promise<{ success: boolean; contactId: string | null; data?: any }> => {
    const apolloKey = process.env.APOLLO_API_KEY;
    let enrichedData: {
      name?: string;
      title?: string;
      email?: string;
      phone?: string;
      profilePictureUrl?: string;
      headline?: string;
      apolloData?: any;
      source: "apollo" | "linkedin" | "manual";
    } = { source: "manual" };

    if (apolloKey) {
      try {
        const apolloRes = await fetch(
          "https://api.apollo.io/api/v1/people/match",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Api-Key": apolloKey,
            },
            body: JSON.stringify({ linkedin_url: linkedinUrl }),
          }
        );

        if (apolloRes.ok) {
          const data = await apolloRes.json();
          const person = data.person;
          if (person) {
            enrichedData = {
              name: person.name || person.first_name + " " + person.last_name,
              title: person.title,
              email: person.email,
              phone: person.phone_numbers?.[0]?.sanitized_number,
              profilePictureUrl: person.photo_url,
              headline: person.headline,
              apolloData: person,
              source: "apollo",
            };
          }
        }
      } catch {
        // Apollo failed
      }
    }

    if (!enrichedData.profilePictureUrl || !enrichedData.headline) {
      try {
        const linkedinRes = await fetch(linkedinUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          },
        });
        if (linkedinRes.ok) {
          const html = await linkedinRes.text();
          if (!enrichedData.profilePictureUrl) {
            const ogImage = html.match(
              /<meta property="og:image" content="([^"]+)"/
            );
            if (ogImage) enrichedData.profilePictureUrl = ogImage[1];
          }
          if (!enrichedData.name) {
            const ogTitle = html.match(
              /<meta property="og:title" content="([^"]+)"/
            );
            if (ogTitle) {
              const parts = ogTitle[1].split(" - ");
              enrichedData.name = parts[0]?.trim();
              if (!enrichedData.headline && parts.length > 1) {
                enrichedData.headline = parts
                  .slice(1)
                  .join(" - ")
                  .replace(" | LinkedIn", "")
                  .trim();
              }
            }
          }
          if (enrichedData.name && enrichedData.source === "manual") {
            enrichedData.source = "linkedin";
          }
        }
      } catch {
        // LinkedIn scrape failed
      }
    }

    if (!enrichedData.name) {
      return { success: false, contactId: null };
    }

    const contactId = await ctx.runMutation(api.outreachContacts.create, {
      companyId,
      name: enrichedData.name,
      title: enrichedData.title,
      linkedinUrl,
      email: enrichedData.email,
      phone: enrichedData.phone,
      profilePictureUrl: enrichedData.profilePictureUrl,
      headline: enrichedData.headline,
      source: enrichedData.source,
      apolloData: enrichedData.apolloData,
    });

    return { success: true, contactId, data: enrichedData };
  },
});
