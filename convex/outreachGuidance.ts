import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePerson } from "./helpers/auth";

const guidanceChannelValidator = v.union(
  v.literal("linkedin"),
  v.literal("email"),
  v.literal("whatsapp")
);

export const listByContact = query({
  args: { contactId: v.id("outreachContacts") },
  handler: async (ctx, { contactId }) => {
    return await ctx.db
      .query("outreachGuidance")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .collect();
  },
});

export const upsert = mutation({
  args: {
    contactId: v.id("outreachContacts"),
    channel: guidanceChannelValidator,
    guidance: v.string(),
  },
  handler: async (ctx, { contactId, channel, guidance }) => {
    await requirePerson(ctx);
    const existing = await ctx.db
      .query("outreachGuidance")
      .withIndex("by_contact_and_channel", (q) =>
        q.eq("contactId", contactId).eq("channel", channel)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        guidance,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("outreachGuidance", {
      contactId,
      channel,
      guidance,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("outreachGuidance") },
  handler: async (ctx, { id }) => {
    await requirePerson(ctx);
    await ctx.db.delete(id);
  },
});
