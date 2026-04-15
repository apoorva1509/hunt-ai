import { mutation } from "./_generated/server";
import { getCurrentPerson } from "./helpers/auth";

export const seedTestData = mutation({
  args: {},
  handler: async (ctx) => {
    // Get current logged-in person
    let person = await getCurrentPerson(ctx);

    if (!person) {
      // Create a person record for the current user
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Not authenticated — sign in first");

      const personId = await ctx.db.insert("people", {
        clerkTokenIdentifier: identity.tokenIdentifier,
        name: identity.name ?? "Test User",
        email: identity.email ?? undefined,
        source: "clerk_signup",
        updatedAt: Date.now(),
      });
      person = (await ctx.db.get(personId))!;
    }

    // Create an agent
    const agentId = await ctx.db.insert("agents", {
      ownerPersonId: person._id,
      name: "Job Hunter",
      type: "job_hunter",
      status: "active",
      config: {},
      updatedAt: Date.now(),
    });

    // Create 3 test companies
    const stripe = await ctx.db.insert("companies", {
      domain: "stripe.com",
      name: "Stripe",
      description: "Financial infrastructure for the internet",
      city: "San Francisco",
      country: "US",
      employees: 8000,
      industries: ["Fintech", "Payments"],
    });

    const anthropic = await ctx.db.insert("companies", {
      domain: "anthropic.com",
      name: "Anthropic",
      description: "AI safety company",
      city: "San Francisco",
      country: "US",
      employees: 1000,
      industries: ["AI", "Machine Learning"],
    });

    const vercel = await ctx.db.insert("companies", {
      domain: "vercel.com",
      name: "Vercel",
      description: "Frontend cloud platform",
      city: "San Francisco",
      country: "US",
      employees: 500,
      industries: ["Developer Tools", "Cloud"],
    });

    // Create test people (contacts)
    const jane = await ctx.db.insert("people", {
      name: "Jane Smith",
      source: "manual",
      updatedAt: Date.now(),
    });

    const bob = await ctx.db.insert("people", {
      name: "Bob Johnson",
      source: "manual",
      updatedAt: Date.now(),
    });

    const alice = await ctx.db.insert("people", {
      name: "Alice Chen",
      source: "manual",
      updatedAt: Date.now(),
    });

    const sam = await ctx.db.insert("people", {
      name: "Sam Wilson",
      source: "manual",
      updatedAt: Date.now(),
    });

    const maria = await ctx.db.insert("people", {
      name: "Maria Garcia",
      source: "manual",
      updatedAt: Date.now(),
    });

    const now = Date.now();
    const day = 86400000;

    // Create connection requests
    // Stripe: 3 connections — 1 accepted, 1 pending with no note (5 days), 1 pending with note
    await ctx.db.insert("connectionRequests", {
      agentId,
      personId: jane,
      companyId: stripe,
      contactRole: "Senior Recruiter",
      contactType: "recruiter",
      sentDate: now - 7 * day,
      status: "accepted",
      noteWithRequest: true,
      messageSent: false,
      updatedAt: now - 2 * day,
    });

    await ctx.db.insert("connectionRequests", {
      agentId,
      personId: bob,
      companyId: stripe,
      contactRole: "Engineering Manager",
      contactType: "hiring_manager",
      sentDate: now - 5 * day,
      status: "pending",
      noteWithRequest: false,
      messageSent: false,
      updatedAt: now - 5 * day,
    });

    await ctx.db.insert("connectionRequests", {
      agentId,
      personId: sam,
      companyId: stripe,
      contactRole: "Co-Founder",
      contactType: "founder",
      sentDate: now - 2 * day,
      status: "pending",
      noteWithRequest: true,
      messageSent: false,
      updatedAt: now - 2 * day,
    });

    // Anthropic: 2 connections — 1 accepted + messaged, 1 suggested
    await ctx.db.insert("connectionRequests", {
      agentId,
      personId: alice,
      companyId: anthropic,
      contactRole: "Head of Engineering",
      contactType: "hiring_manager",
      sentDate: now - 10 * day,
      status: "accepted",
      noteWithRequest: true,
      messageSent: true,
      messageDate: now - 8 * day,
      updatedAt: now - 8 * day,
    });

    await ctx.db.insert("connectionRequests", {
      agentId,
      personId: maria,
      companyId: anthropic,
      contactRole: "Technical Recruiter",
      contactType: "recruiter",
      sentDate: now,
      status: "suggested",
      noteWithRequest: false,
      messageSent: false,
      updatedAt: now,
    });

    // Vercel: 1 pending, no note, 4 days old (should trigger follow-up)
    await ctx.db.insert("connectionRequests", {
      agentId,
      personId: bob,
      companyId: vercel,
      contactRole: "VP Engineering",
      contactType: "executive",
      sentDate: now - 4 * day,
      status: "pending",
      noteWithRequest: false,
      messageSent: false,
      updatedAt: now - 4 * day,
    });

    // Create some job leads
    await ctx.db.insert("agentItems", {
      agentId,
      type: "job_lead",
      title: "Senior AI Engineer at Stripe",
      companyId: stripe,
      status: "approved",
      data: {
        company: "Stripe",
        role: "Senior AI Engineer",
        url: "https://stripe.com/jobs/123",
        jobBoard: "careers_page",
        matchScore: 85,
        matchReason: "Strong AI/ML fit with fintech domain",
        corePain: "Scaling fraud detection models",
        urgencySignal: "New team forming",
        aiGap: "Need ML engineers for payments intelligence",
        techStack: ["Python", "PyTorch", "Kubernetes"],
        competitors: ["Square", "Adyen"],
        archetype: "AI Engineer",
        workMode: "hybrid",
        scoreDimensions: {
          northStar: 8, cvMatch: 9, seniority: 8, compensation: 7,
          growth: 8, remoteQuality: 6, reputation: 9, techStack: 8,
          speedToOffer: 7, culturalSignals: 8, total: 85,
        },
      },
      updatedAt: now - 3 * day,
    });

    await ctx.db.insert("agentItems", {
      agentId,
      type: "job_lead",
      title: "ML Platform Engineer at Anthropic",
      companyId: anthropic,
      status: "actioned",
      data: {
        company: "Anthropic",
        role: "ML Platform Engineer",
        url: "https://anthropic.com/jobs/456",
        jobBoard: "careers_page",
        matchScore: 92,
        matchReason: "Perfect AI safety alignment",
        corePain: "Scaling training infrastructure",
        urgencySignal: "Rapid growth phase",
        aiGap: "Infrastructure for next-gen models",
        techStack: ["Python", "JAX", "GCP"],
        competitors: ["OpenAI", "DeepMind"],
        archetype: "ML Engineer",
        workMode: "remote",
        scoreDimensions: {
          northStar: 10, cvMatch: 9, seniority: 9, compensation: 8,
          growth: 10, remoteQuality: 9, reputation: 10, techStack: 9,
          speedToOffer: 8, culturalSignals: 9, total: 92,
        },
      },
      updatedAt: now - 5 * day,
    });

    return {
      agentId,
      companies: { stripe, anthropic, vercel },
      message: "Seed data created! Refresh the page and select 'Job Hunter' agent.",
    };
  },
});
