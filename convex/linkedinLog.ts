import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal-only mutation for CLI-based linkedin-log.
 * Bypasses auth since it runs via `npx convex run`.
 */
export const patchPerson = internalMutation({
  args: {
    personId: v.id("people"),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
  },
  handler: async (ctx, { personId, ...fields }) => {
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(personId, updates);
  },
});

export const logConnection = internalMutation({
  args: {
    personName: v.string(),
    personLinkedinUrl: v.optional(v.string()),
    companyDomain: v.string(),
    companyName: v.string(),
    companyLinkedinUrl: v.optional(v.string()),
    contactTitle: v.string(),
    contactType: v.union(
      v.literal("recruiter"),
      v.literal("hiring_manager"),
      v.literal("peer"),
      v.literal("founder"),
      v.literal("executive"),
      v.literal("other")
    ),
    connectionStatus: v.union(
      v.literal("suggested"),
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("ignored")
    ),
    messageSent: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Find or create company
    const existingCompany = await ctx.db
      .query("companies")
      .withIndex("by_domain", (q) => q.eq("domain", args.companyDomain))
      .first();
    const companyId =
      existingCompany?._id ??
      (await ctx.db.insert("companies", {
        domain: args.companyDomain,
        name: args.companyName,
        linkedinUrl: args.companyLinkedinUrl,
      }));

    // 2. Find or create person
    let person = args.personLinkedinUrl
      ? await ctx.db
          .query("people")
          .withIndex("by_linkedin", (q) =>
            q.eq("linkedinUrl", args.personLinkedinUrl)
          )
          .first()
      : null;
    if (!person) {
      // Search by name as fallback
      const allPeople = await ctx.db.query("people").collect();
      person =
        allPeople.find(
          (p) => p.name.toLowerCase() === args.personName.toLowerCase()
        ) ?? null;
    }
    const personId =
      person?._id ??
      (await ctx.db.insert("people", {
        name: args.personName,
        linkedinUrl: args.personLinkedinUrl,
        source: "manual",
        updatedAt: Date.now(),
      }));

    // 3. Link person to company
    const existingLink = await ctx.db
      .query("personCompanyLinks")
      .withIndex("by_person_and_company", (q) =>
        q.eq("personId", personId).eq("companyId", companyId)
      )
      .first();
    if (!existingLink) {
      await ctx.db.insert("personCompanyLinks", {
        personId,
        companyId,
        type: args.contactType === "recruiter" ? "recruiter" : args.contactType === "hiring_manager" ? "hiring_manager" : args.contactType === "founder" ? "founder" : "employee",
        status: "active",
        title: args.contactTitle,
        source: "linkedin",
        updatedAt: Date.now(),
      });
    }

    // 4. Find or create active agent
    const agents = await ctx.db.query("agents").collect();
    let activeAgent = agents.find(
      (a) => a.type === "job_hunter" && a.status === "active"
    );
    if (!activeAgent) {
      // Create a default agent owned by this person (or first person)
      const owner = person ?? (await ctx.db.query("people").first());
      if (!owner) throw new Error("No people in DB. Create a person first.");
      const agentId = await ctx.db.insert("agents", {
        ownerPersonId: owner._id,
        name: "Job Hunter",
        type: "job_hunter",
        status: "active",
        config: {},
        updatedAt: Date.now(),
      });
      activeAgent = (await ctx.db.get(agentId))!;
    }

    // 5. Find or create connection request (dedup by personId + companyId)
    const now = Date.now();
    const existingRequest = await ctx.db
      .query("connectionRequests")
      .filter((q) =>
        q.and(
          q.eq(q.field("personId"), personId),
          q.eq(q.field("companyId"), companyId)
        )
      )
      .first();

    const requestId = existingRequest
      ? existingRequest._id
      : await ctx.db.insert("connectionRequests", {
          agentId: activeAgent._id,
          personId,
          companyId,
          contactRole: args.contactTitle,
          contactType: args.contactType,
          sentDate: now,
          status: args.connectionStatus,
          noteWithRequest: args.messageSent,
          messageSent: args.messageSent,
          messageDate: args.messageSent ? now : undefined,
          notes: args.notes,
          updatedAt: now,
        });

    // Update status if the request already existed (e.g., pending → accepted)
    if (existingRequest && existingRequest.status !== args.connectionStatus) {
      await ctx.db.patch(existingRequest._id, {
        status: args.connectionStatus,
        updatedAt: now,
      });
    }

    // 6. Check for linked job leads
    const leads = await ctx.db
      .query("agentItems")
      .withIndex("by_agent_and_type", (q) =>
        q.eq("agentId", activeAgent._id).eq("type", "job_lead")
      )
      .collect();
    const matchingLead = leads.find((l) => l.companyId === companyId);
    if (matchingLead) {
      await ctx.db.patch(requestId, { linkedToLeadId: matchingLead._id });
    }

    return {
      personId,
      companyId,
      requestId,
      linkedToLead: matchingLead
        ? { id: matchingLead._id, title: matchingLead.title }
        : null,
    };
  },
});
