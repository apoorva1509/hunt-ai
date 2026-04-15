import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requirePerson } from "./helpers/auth";
import { internal } from "./_generated/api";

const channelValidator = v.union(
  v.literal("linkedin_dm"),
  v.literal("linkedin_connection"),
  v.literal("email"),
  v.literal("whatsapp")
);

const directionValidator = v.union(
  v.literal("outbound"),
  v.literal("inbound")
);

export const listByContact = query({
  args: { contactId: v.id("outreachContacts") },
  handler: async (ctx, { contactId }) => {
    return await ctx.db
      .query("outreachMessages")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .order("desc")
      .collect();
  },
});

export const listByCompany = query({
  args: { companyId: v.id("outreachCompanies") },
  handler: async (ctx, { companyId }) => {
    return await ctx.db
      .query("outreachMessages")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    contactId: v.id("outreachContacts"),
    companyId: v.id("outreachCompanies"),
    channel: channelValidator,
    body: v.string(),
    sentAt: v.number(),
    direction: directionValidator,
    gmailMessageId: v.optional(v.string()),
    gmailThreadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePerson(ctx);
    const messageId = await ctx.db.insert("outreachMessages", {
      ...args,
      updatedAt: Date.now(),
    });

    if (args.direction === "outbound") {
      await ctx.scheduler.runAfter(
        0,
        internal.followUpReminders.markActedForContact,
        { contactId: args.contactId }
      );
    } else if (args.direction === "inbound") {
      await ctx.db.patch(args.contactId, {
        followUpEnabled: false,
        followUpStoppedReason: "replied" as const,
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(
        0,
        internal.followUpReminders.dismissAllForContact,
        { contactId: args.contactId }
      );
    }

    return messageId;
  },
});

export const getByGmailMessageId = query({
  args: { gmailMessageId: v.string() },
  handler: async (ctx, { gmailMessageId }) => {
    return await ctx.db
      .query("outreachMessages")
      .withIndex("by_gmail_message_id", (q) =>
        q.eq("gmailMessageId", gmailMessageId)
      )
      .first();
  },
});

export const update = mutation({
  args: {
    id: v.id("outreachMessages"),
    body: v.optional(v.string()),
    channel: v.optional(channelValidator),
    sentAt: v.optional(v.number()),
    direction: v.optional(directionValidator),
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

export const remove = mutation({
  args: { id: v.id("outreachMessages") },
  handler: async (ctx, { id }) => {
    await requirePerson(ctx);
    await ctx.db.delete(id);
  },
});

// Internal: create message without auth (used by HTTP endpoint for LinkedIn sync)
export const createFromSync = internalMutation({
  args: {
    contactId: v.id("outreachContacts"),
    companyId: v.id("outreachCompanies"),
    channel: channelValidator,
    body: v.string(),
    sentAt: v.number(),
    direction: directionValidator,
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("outreachMessages", {
      ...args,
      updatedAt: Date.now(),
    });

    if (args.direction === "inbound") {
      await ctx.db.patch(args.contactId, {
        followUpEnabled: false,
        followUpStoppedReason: "replied" as const,
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(
        0,
        internal.followUpReminders.dismissAllForContact,
        { contactId: args.contactId }
      );
    } else if (args.direction === "outbound") {
      await ctx.scheduler.runAfter(
        0,
        internal.followUpReminders.markActedForContact,
        { contactId: args.contactId }
      );
    }

    return messageId;
  },
});

export const deleteInternal = internalMutation({
  args: { id: v.id("outreachMessages") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
