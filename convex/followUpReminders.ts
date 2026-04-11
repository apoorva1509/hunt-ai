import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentPerson } from "./helpers/auth";

const channelValidator = v.union(
  v.literal("linkedin_dm"),
  v.literal("linkedin_connection"),
  v.literal("email")
);

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    const person = await getCurrentPerson(ctx);
    if (!person) return [];
    const userId = person.clerkTokenIdentifier!;

    const companies = await ctx.db
      .query("outreachCompanies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const companyIds = new Set(companies.map((c) => c._id));

    const pending = await ctx.db
      .query("followUpReminders")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const notified = await ctx.db
      .query("followUpReminders")
      .withIndex("by_status", (q) => q.eq("status", "notified"))
      .collect();

    return [...pending, ...notified].filter((r) => companyIds.has(r.companyId));
  },
});

export const listByContact = query({
  args: { contactId: v.id("outreachContacts") },
  handler: async (ctx, { contactId }) => {
    return await ctx.db
      .query("followUpReminders")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .collect();
  },
});

export const countOverdue = query({
  args: {},
  handler: async (ctx) => {
    const person = await getCurrentPerson(ctx);
    if (!person) return 0;
    const userId = person.clerkTokenIdentifier!;

    const companies = await ctx.db
      .query("outreachCompanies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const companyIds = new Set(companies.map((c) => c._id));

    const pending = await ctx.db
      .query("followUpReminders")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const notified = await ctx.db
      .query("followUpReminders")
      .withIndex("by_status", (q) => q.eq("status", "notified"))
      .collect();

    return [...pending, ...notified].filter((r) => companyIds.has(r.companyId))
      .length;
  },
});

export const dismiss = mutation({
  args: { id: v.id("followUpReminders") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "dismissed", updatedAt: Date.now() });
  },
});

export const markNotified = mutation({
  args: { id: v.id("followUpReminders") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "notified", updatedAt: Date.now() });
  },
});

export const markActed = mutation({
  args: { id: v.id("followUpReminders") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "acted", updatedAt: Date.now() });
  },
});

export const createReminder = internalMutation({
  args: {
    contactId: v.id("outreachContacts"),
    companyId: v.id("outreachCompanies"),
    channel: channelValidator,
    dueAt: v.number(),
    lastOutboundMessageId: v.optional(v.id("outreachMessages")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("followUpReminders", {
      ...args,
      status: "pending",
      updatedAt: Date.now(),
    });
  },
});

export const dismissAllForContact = internalMutation({
  args: { contactId: v.id("outreachContacts") },
  handler: async (ctx, { contactId }) => {
    const reminders = await ctx.db
      .query("followUpReminders")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .collect();
    const now = Date.now();
    for (const r of reminders) {
      if (r.status === "pending" || r.status === "notified") {
        await ctx.db.patch(r._id, { status: "dismissed", updatedAt: now });
      }
    }
  },
});

export const markActedForContact = internalMutation({
  args: { contactId: v.id("outreachContacts") },
  handler: async (ctx, { contactId }) => {
    const reminders = await ctx.db
      .query("followUpReminders")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .collect();
    const now = Date.now();
    for (const r of reminders) {
      if (r.status === "pending" || r.status === "notified") {
        await ctx.db.patch(r._id, { status: "acted", updatedAt: now });
      }
    }
  },
});
