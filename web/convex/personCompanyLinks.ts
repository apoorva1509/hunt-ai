import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePerson } from "./helpers/auth";

const linkTypeValidator = v.union(
  v.literal("employee"),
  v.literal("contractor"),
  v.literal("intern"),
  v.literal("founder"),
  v.literal("investor"),
  v.literal("board_member"),
  v.literal("advisor"),
  v.literal("client"),
  v.literal("vendor"),
  v.literal("candidate"),
  v.literal("recruiter"),
  v.literal("hiring_manager"),
  v.literal("referral")
);

const linkStatusValidator = v.union(
  v.literal("active"),
  v.literal("past"),
  v.literal("prospective")
);

export const findOrCreate = mutation({
  args: {
    personId: v.id("people"),
    companyId: v.id("companies"),
    type: linkTypeValidator,
    status: linkStatusValidator,
    title: v.optional(v.string()),
    source: v.optional(
      v.union(
        v.literal("clerk_signup"),
        v.literal("agent_discovered"),
        v.literal("linkedin"),
        v.literal("manual")
      )
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePerson(ctx);
    const existing = await ctx.db
      .query("personCompanyLinks")
      .withIndex("by_person_and_company", (q) =>
        q.eq("personId", args.personId).eq("companyId", args.companyId)
      )
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("personCompanyLinks", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});

export const getByPerson = query({
  args: { personId: v.id("people") },
  handler: async (ctx, { personId }) => {
    return await ctx.db
      .query("personCompanyLinks")
      .withIndex("by_person", (q) => q.eq("personId", personId))
      .collect();
  },
});

export const getByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    return await ctx.db
      .query("personCompanyLinks")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
  },
});
