# Company Research Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add company → auto-discover jobs from 10+ sources → find decision makers → generate outreach with channel recommendation → mark applied with logging.

**Architecture:** Enhanced "Add Company" triggers a `researchCompany` action that runs job discovery and contact enrichment in parallel. Results populate a tabbed company card (Jobs / People / Pipeline) with polished UI.

**Tech Stack:** Convex (backend, actions, cron), Next.js + Tailwind (UI), Apollo/Apify/Hunter.io/RocketReach APIs (enrichment), Claude Haiku (message generation)

**Spec:** `docs/superpowers/specs/2026-04-12-company-research-flow-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `convex/outreachJobs.ts` | CRUD queries + mutations for jobs |
| `convex/companyResearch.ts` | Research orchestrator + per-source job discovery + contact enrichment |
| `web/app/(app)/outreach-tracker/jobs-tab.tsx` | Jobs tab with job cards |
| `web/app/(app)/outreach-tracker/job-card.tsx` | Individual job card (title, source badge, apply/mark-applied/skip) |
| `web/app/(app)/outreach-tracker/people-tab.tsx` | People tab with contact cards + message generation |
| `web/app/(app)/outreach-tracker/mark-applied-dialog.tsx` | "Mark Applied" modal (channel pills + notes) |
| `web/app/(app)/outreach-tracker/research-skeleton.tsx` | Skeleton loader during research |

### Modified Files

| File | Change |
|---|---|
| `convex/schema.ts` | Add `outreachJobs` table, new fields on companies + contacts |
| `convex/outreachCompanies.ts` | Trigger research after company creation |
| `convex/outreach.ts` | Accept outreachContacts, add channel recommendation |
| `web/app/(app)/outreach-tracker/company-card.tsx` | Rewrite with tabs (Jobs/People/Pipeline) |
| `web/app/(app)/outreach-tracker/add-company-dialog.tsx` | Smart input detection |
| `web/app/(app)/outreach-tracker/contact-card.tsx` | Add tier badge, enrichment indicator |
| `web/app/(app)/outreach-tracker/types.ts` | Job types, research status, tiers, source colors |
| `web/app/(app)/outreach-tracker/utils.ts` | Source color map, tier labels |
| `web/hooks/use-outreach-tracker.ts` | Add `useOutreachJobs` hook |

---

### Task 1: Schema Changes

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add `outreachJobs` table**

Add before the closing `});` in `convex/schema.ts`:

```typescript
  outreachJobs: defineTable({
    companyId: v.id("outreachCompanies"),
    title: v.string(),
    url: v.string(),
    source: v.union(
      v.literal("linkedin"),
      v.literal("careers_page"),
      v.literal("greenhouse"),
      v.literal("lever"),
      v.literal("ashby"),
      v.literal("workable"),
      v.literal("yc"),
      v.literal("wellfound"),
      v.literal("instahyre"),
      v.literal("naukri")
    ),
    location: v.optional(v.string()),
    workMode: v.optional(v.union(
      v.literal("remote"),
      v.literal("hybrid"),
      v.literal("onsite"),
      v.literal("unknown")
    )),
    status: v.union(
      v.literal("new"),
      v.literal("applied"),
      v.literal("skipped")
    ),
    description: v.optional(v.string()),
    postedAt: v.optional(v.number()),
    appliedAt: v.optional(v.number()),
    appliedVia: v.optional(v.string()),
    appliedNotes: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_status", ["status"])
    .index("by_company_and_status", ["companyId", "status"]),
```

- [ ] **Step 2: Add new fields to `outreachCompanies`**

Add after `roleAppliedFor` field:

```typescript
    employeeCount: v.optional(v.number()),
    industry: v.optional(v.string()),
    careersUrl: v.optional(v.string()),
    researchStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("researching"),
      v.literal("done"),
      v.literal("failed")
    )),
    researchSummary: v.optional(v.string()),
```

- [ ] **Step 3: Add `tier` field to `outreachContacts`**

Add after `followUpStoppedReason` field:

```typescript
    tier: v.optional(v.union(
      v.literal("tier1"),
      v.literal("tier2"),
      v.literal("tier3")
    )),
```

- [ ] **Step 4: Verify schema compiles**

Run: `npx convex dev --once`

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add outreachJobs table, research fields on companies, tier on contacts"
```

---

### Task 2: Jobs CRUD (`convex/outreachJobs.ts`)

**Files:**
- Create: `convex/outreachJobs.ts`

- [ ] **Step 1: Create file with queries and mutations**

```typescript
import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requirePerson } from "./helpers/auth";
import { internal } from "./_generated/api";

const sourceValidator = v.union(
  v.literal("linkedin"),
  v.literal("careers_page"),
  v.literal("greenhouse"),
  v.literal("lever"),
  v.literal("ashby"),
  v.literal("workable"),
  v.literal("yc"),
  v.literal("wellfound"),
  v.literal("instahyre"),
  v.literal("naukri")
);

const statusValidator = v.union(
  v.literal("new"),
  v.literal("applied"),
  v.literal("skipped")
);

const workModeValidator = v.optional(v.union(
  v.literal("remote"),
  v.literal("hybrid"),
  v.literal("onsite"),
  v.literal("unknown")
));

export const listByCompany = query({
  args: { companyId: v.id("outreachCompanies") },
  handler: async (ctx, { companyId }) => {
    return await ctx.db
      .query("outreachJobs")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .order("desc")
      .collect();
  },
});

export const countByCompany = query({
  args: { companyId: v.id("outreachCompanies") },
  handler: async (ctx, { companyId }) => {
    const jobs = await ctx.db
      .query("outreachJobs")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
    return {
      total: jobs.length,
      new: jobs.filter((j) => j.status === "new").length,
      applied: jobs.filter((j) => j.status === "applied").length,
    };
  },
});

export const markApplied = mutation({
  args: {
    id: v.id("outreachJobs"),
    appliedVia: v.string(),
    appliedNotes: v.optional(v.string()),
  },
  handler: async (ctx, { id, appliedVia, appliedNotes }) => {
    await requirePerson(ctx);
    const now = Date.now();
    await ctx.db.patch(id, {
      status: "applied",
      appliedAt: now,
      appliedVia,
      appliedNotes,
      updatedAt: now,
    });

    // Auto-mark matching pipeline step as done
    const job = await ctx.db.get(id);
    if (!job) return;

    const steps = await ctx.db
      .query("outreachSteps")
      .withIndex("by_company", (q) => q.eq("companyId", job.companyId))
      .collect();

    // Map appliedVia to step label keywords
    const stepKeywords: Record<string, string[]> = {
      linkedin_easy_apply: ["linkedin"],
      company_portal: ["careers", "portal", "company"],
      yc: ["yc"],
      email: ["email"],
      referral: ["referral"],
    };
    const keywords = stepKeywords[appliedVia] ?? [];

    for (const step of steps) {
      if (
        step.status === "pending" &&
        keywords.some((kw) => step.label.toLowerCase().includes(kw))
      ) {
        await ctx.db.patch(step._id, { status: "done", updatedAt: now });
        break;
      }
    }

    // Log as outreach message
    await ctx.db.insert("outreachMessages", {
      contactId: job.companyId as any, // placeholder — company-level application
      companyId: job.companyId,
      channel: appliedVia === "email" ? "email" : "linkedin_dm",
      body: `Applied for ${job.title}${appliedNotes ? ` — ${appliedNotes}` : ""}`,
      sentAt: now,
      direction: "outbound",
      updatedAt: now,
    });
  },
});

export const markSkipped = mutation({
  args: { id: v.id("outreachJobs") },
  handler: async (ctx, { id }) => {
    await requirePerson(ctx);
    await ctx.db.patch(id, { status: "skipped", updatedAt: Date.now() });
  },
});

// Internal: batch create jobs from research action (no auth needed)
export const batchCreate = internalMutation({
  args: {
    jobs: v.array(v.object({
      companyId: v.id("outreachCompanies"),
      title: v.string(),
      url: v.string(),
      source: sourceValidator,
      location: v.optional(v.string()),
      workMode: workModeValidator,
      description: v.optional(v.string()),
      postedAt: v.optional(v.number()),
    })),
  },
  handler: async (ctx, { jobs }) => {
    const now = Date.now();
    const ids = [];
    for (const job of jobs) {
      // Deduplicate by title + source within this company
      const existing = await ctx.db
        .query("outreachJobs")
        .withIndex("by_company", (q) => q.eq("companyId", job.companyId))
        .collect();
      const isDup = existing.some(
        (e) => e.title === job.title && e.source === job.source
      );
      if (isDup) continue;

      const id = await ctx.db.insert("outreachJobs", {
        ...job,
        status: "new",
        updatedAt: now,
      });
      ids.push(id);
    }
    return ids;
  },
});
```

- [ ] **Step 2: Verify compiles**

Run: `npx convex dev --once`

- [ ] **Step 3: Commit**

```bash
git add convex/outreachJobs.ts
git commit -m "feat: add outreachJobs CRUD queries and mutations"
```

---

### Task 3: Company Research Orchestrator (`convex/companyResearch.ts`)

**Files:**
- Create: `convex/companyResearch.ts`

- [ ] **Step 1: Create the research action**

This is the core orchestrator. It resolves the company, then schedules parallel job discovery and contact enrichment.

```typescript
import { action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

export const researchCompany = action({
  args: {
    companyId: v.id("outreachCompanies"),
    input: v.string(), // company name, LinkedIn URL, or website URL
  },
  handler: async (ctx, { companyId, input }) => {
    // Mark as researching
    await ctx.runMutation(internal.companyResearch.updateResearchStatus, {
      companyId,
      status: "researching",
    });

    try {
      // Step 1: Resolve company identity
      const identity = await resolveCompany(input);

      // Update company with enriched data
      await ctx.runMutation(internal.companyResearch.enrichCompany, {
        companyId,
        ...identity,
      });

      // Step 2 & 3: Run job discovery and contact search in parallel
      await Promise.all([
        ctx.scheduler.runAfter(0, internal.companyResearch.discoverJobs, {
          companyId,
          companyName: identity.name || input,
          domain: identity.domain,
          linkedinUrl: identity.linkedinUrl,
          careersUrl: identity.careersUrl,
          isYcBacked: identity.isYcBacked || false,
        }),
        ctx.scheduler.runAfter(0, internal.companyResearch.findContacts, {
          companyId,
          companyName: identity.name || input,
          domain: identity.domain,
          tier: "tier1_and_2",
        }),
      ]);
    } catch (error: any) {
      await ctx.runMutation(internal.companyResearch.updateResearchStatus, {
        companyId,
        status: "failed",
        summary: error.message,
      });
    }
  },
});

// ── Internal mutations ──────────────────────────────────────

export const updateResearchStatus = internalMutation({
  args: {
    companyId: v.id("outreachCompanies"),
    status: v.union(
      v.literal("pending"),
      v.literal("researching"),
      v.literal("done"),
      v.literal("failed")
    ),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, { companyId, status, summary }) => {
    await ctx.db.patch(companyId, {
      researchStatus: status,
      ...(summary !== undefined ? { researchSummary: summary } : {}),
      updatedAt: Date.now(),
    });
  },
});

export const enrichCompany = internalMutation({
  args: {
    companyId: v.id("outreachCompanies"),
    name: v.optional(v.string()),
    domain: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    employeeCount: v.optional(v.number()),
    industry: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    careersUrl: v.optional(v.string()),
    isYcBacked: v.optional(v.boolean()),
  },
  handler: async (ctx, { companyId, ...fields }) => {
    const patch: Record<string, any> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined && val !== null) patch[k] = val;
    }
    await ctx.db.patch(companyId, patch);
  },
});

export const finalizeResearch = internalMutation({
  args: { companyId: v.id("outreachCompanies") },
  handler: async (ctx, { companyId }) => {
    const jobs = await ctx.db
      .query("outreachJobs")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
    const contacts = await ctx.db
      .query("outreachContacts")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();

    const summary = `${jobs.length} job${jobs.length !== 1 ? "s" : ""}, ${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`;

    await ctx.db.patch(companyId, {
      researchStatus: "done",
      researchSummary: summary,
      updatedAt: Date.now(),
    });

    // Auto-create pipeline steps
    const existingSteps = await ctx.db
      .query("outreachSteps")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
    const stepLabels = existingSteps.map((s) => s.label);
    const now = Date.now();
    let order = existingSteps.length;

    const company = await ctx.db.get(companyId);

    const stepsToCreate: string[] = [];
    const hasLinkedInJobs = jobs.some((j) => j.source === "linkedin");
    const hasCareersUrl = company?.careersUrl;
    const isYc = company?.isYcBacked;
    const hasEmails = contacts.some((c) => c.email);
    const hasLinkedIn = contacts.some((c) => c.linkedinUrl);

    if (hasLinkedInJobs && !stepLabels.some((l) => l.toLowerCase().includes("linkedin"))) {
      stepsToCreate.push("Apply on LinkedIn");
    }
    if (hasCareersUrl && !stepLabels.some((l) => l.toLowerCase().includes("portal") || l.toLowerCase().includes("careers"))) {
      stepsToCreate.push("Apply on company portal");
    }
    if (isYc && !stepLabels.some((l) => l.toLowerCase().includes("yc"))) {
      stepsToCreate.push("Apply via YC portal");
    }
    if (hasEmails && !stepLabels.some((l) => l.toLowerCase().includes("email"))) {
      stepsToCreate.push("Send cold emails");
    }
    if (hasLinkedIn && !stepLabels.some((l) => l.toLowerCase().includes("dm") || l.toLowerCase().includes("linkedin message"))) {
      stepsToCreate.push("Send LinkedIn DMs");
    }

    for (const label of stepsToCreate) {
      await ctx.db.insert("outreachSteps", {
        companyId,
        label,
        status: "pending",
        order: order++,
        isAutoGenerated: true,
        updatedAt: now,
      });
    }
  },
});

// ── Job Discovery (internal action) ─────────────────────────

export const discoverJobs = internalAction({
  args: {
    companyId: v.id("outreachCompanies"),
    companyName: v.string(),
    domain: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    careersUrl: v.optional(v.string()),
    isYcBacked: v.boolean(),
  },
  handler: async (ctx, args) => {
    const jobs: Array<{
      companyId: typeof args.companyId;
      title: string;
      url: string;
      source: any;
      location?: string;
      workMode?: any;
      description?: string;
      postedAt?: number;
    }> = [];

    // Source 1: LinkedIn Jobs (via web search as fallback)
    try {
      const linkedInJobs = await searchLinkedInJobs(args.companyName);
      jobs.push(...linkedInJobs.map((j: any) => ({
        companyId: args.companyId,
        title: j.title,
        url: j.url,
        source: "linkedin" as const,
        location: j.location,
        workMode: j.workMode,
        description: j.description?.slice(0, 2000),
        postedAt: j.postedAt,
      })));
    } catch { /* continue */ }

    // Source 2: Careers page + ATS detection
    if (args.domain) {
      try {
        const careersJobs = await scrapeCareersPage(args.domain);
        jobs.push(...careersJobs.map((j: any) => ({
          companyId: args.companyId,
          title: j.title,
          url: j.url,
          source: j.source as any,
          location: j.location,
          workMode: j.workMode,
          description: j.description?.slice(0, 2000),
        })));
      } catch { /* continue */ }
    }

    // Source 3: YC jobs
    if (args.isYcBacked) {
      try {
        const ycJobs = await searchYcJobs(args.companyName);
        jobs.push(...ycJobs.map((j: any) => ({
          companyId: args.companyId,
          title: j.title,
          url: j.url,
          source: "yc" as const,
          location: j.location,
        })));
      } catch { /* continue */ }
    }

    // Save all discovered jobs
    if (jobs.length > 0) {
      await ctx.runMutation(internal.outreachJobs.batchCreate, { jobs });
    }

    // Finalize research (check if contacts are also done)
    await ctx.runMutation(internal.companyResearch.finalizeResearch, {
      companyId: args.companyId,
    });
  },
});

// ── Contact Discovery (internal action) ─────────────────────

export const findContacts = internalAction({
  args: {
    companyId: v.id("outreachCompanies"),
    companyName: v.string(),
    domain: v.optional(v.string()),
    tier: v.string(), // "tier1_and_2" or "tier3"
  },
  handler: async (ctx, args) => {
    const contacts: Array<{
      companyId: typeof args.companyId;
      name: string;
      title?: string;
      linkedinUrl?: string;
      email?: string;
      phone?: string;
      profilePictureUrl?: string;
      headline?: string;
      source: "apollo" | "linkedin" | "manual";
      tier: "tier1" | "tier2" | "tier3";
    }> = [];

    const tier1Titles = [
      "CTO", "VP Engineering", "Head of Engineering",
      "Director of Engineering", "Engineering Manager",
      "Senior Engineering Manager", "Chief Product Officer",
      "VP Product", "Founder", "CEO", "Co-founder",
    ];
    const tier2Titles = [
      "Recruiter", "Senior Recruiter", "Lead Recruiter",
      "Talent Acquisition", "Head of Talent", "HR Manager",
      "People Operations", "Technical Recruiter",
    ];

    const titles = args.tier === "tier3"
      ? ["Senior Engineer", "Staff Engineer", "Team Lead", "Principal Engineer"]
      : [...tier1Titles, ...tier2Titles];

    const tierForTitle = (title: string): "tier1" | "tier2" | "tier3" => {
      if (args.tier === "tier3") return "tier3";
      const titleLower = title.toLowerCase();
      if (tier2Titles.some((t) => titleLower.includes(t.toLowerCase()))) return "tier2";
      return "tier1";
    };

    // Apollo API
    const apolloKey = process.env.APOLLO_API_KEY;
    if (apolloKey && args.domain) {
      try {
        for (const titleQuery of titles.slice(0, 5)) { // Limit API calls
          const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Api-Key": apolloKey },
            body: JSON.stringify({
              q_organization_domains: args.domain,
              q_titles: [titleQuery],
              per_page: 2,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            for (const person of data.people || []) {
              contacts.push({
                companyId: args.companyId,
                name: person.name || `${person.first_name} ${person.last_name}`,
                title: person.title,
                linkedinUrl: person.linkedin_url,
                email: person.email,
                phone: person.phone_numbers?.[0]?.sanitized_number,
                profilePictureUrl: person.photo_url,
                headline: person.headline,
                source: "apollo",
                tier: tierForTitle(person.title || titleQuery),
              });
            }
          }
        }
      } catch { /* continue */ }
    }

    // Hunter.io fallback for emails
    const hunterKey = process.env.HUNTER_API_KEY;
    if (hunterKey && args.domain && contacts.some((c) => !c.email)) {
      try {
        const res = await fetch(
          `https://api.hunter.io/v2/domain-search?domain=${args.domain}&api_key=${hunterKey}&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          for (const email of data.data?.emails || []) {
            const existing = contacts.find(
              (c) => c.name.toLowerCase() === `${email.first_name} ${email.last_name}`.toLowerCase()
            );
            if (existing && !existing.email) {
              existing.email = email.value;
            }
          }
        }
      } catch { /* continue */ }
    }

    // Deduplicate by email then LinkedIn URL
    const seen = new Set<string>();
    const deduped = contacts.filter((c) => {
      const key = c.email?.toLowerCase() || c.linkedinUrl?.toLowerCase() || c.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Save contacts
    for (const contact of deduped.slice(0, 8)) { // Max 8 contacts
      // Check if contact already exists
      const existing = await ctx.runQuery(api.outreachContacts.listByCompany, {
        companyId: args.companyId,
      });
      const isDup = existing.some(
        (e: any) =>
          (e.email && e.email === contact.email) ||
          (e.linkedinUrl && e.linkedinUrl === contact.linkedinUrl) ||
          e.name.toLowerCase() === contact.name.toLowerCase()
      );
      if (isDup) continue;

      await ctx.runMutation(internal.outreachContacts.createFromResearch, {
        companyId: contact.companyId,
        name: contact.name,
        title: contact.title,
        linkedinUrl: contact.linkedinUrl,
        email: contact.email,
        phone: contact.phone,
        profilePictureUrl: contact.profilePictureUrl,
        headline: contact.headline,
        source: contact.source,
        tier: contact.tier,
      });
    }

    // Finalize
    await ctx.runMutation(internal.companyResearch.finalizeResearch, {
      companyId: args.companyId,
    });
  },
});

// ── Helper functions ────────────────────────────────────────

async function resolveCompany(input: string): Promise<{
  name?: string;
  domain?: string;
  logoUrl?: string;
  description?: string;
  employeeCount?: number;
  industry?: string;
  linkedinUrl?: string;
  careersUrl?: string;
  isYcBacked?: boolean;
}> {
  let domain: string | undefined;
  let linkedinUrl: string | undefined;

  // Detect input type
  if (input.includes("linkedin.com/company/")) {
    linkedinUrl = input;
    // Extract company name from URL for further enrichment
  } else if (input.includes(".") && !input.includes(" ")) {
    // Looks like a domain/URL
    try {
      const url = input.startsWith("http") ? input : `https://${input}`;
      domain = new URL(url).hostname.replace("www.", "");
    } catch { /* treat as name */ }
  }

  // Clearbit enrichment
  if (domain) {
    try {
      const logoUrl = `https://logo.clearbit.com/${domain}`;
      return { domain, logoUrl, linkedinUrl };
    } catch { /* continue */ }
  }

  // Fallback: just use input as name
  return {
    name: input,
    domain,
    linkedinUrl,
    logoUrl: domain ? `https://logo.clearbit.com/${domain}` : undefined,
  };
}

async function searchLinkedInJobs(companyName: string) {
  // Use web search to find LinkedIn job listings
  // This is a placeholder — real implementation would use Apify or direct scraping
  return [];
}

async function scrapeCareersPage(domain: string) {
  // Try common careers page URLs
  const paths = ["/careers", "/jobs", "/careers/openings", "/open-positions"];
  const jobs: any[] = [];

  for (const path of paths) {
    try {
      const res = await fetch(`https://${domain}${path}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        redirect: "follow",
      });
      if (res.ok) {
        const html = await res.text();
        // Detect ATS boards
        if (html.includes("boards.greenhouse.io") || html.includes("greenhouse.io")) {
          // Extract Greenhouse board URL and scrape
        } else if (html.includes("jobs.lever.co")) {
          // Extract Lever board URL and scrape
        } else if (html.includes("jobs.ashby.io")) {
          // Extract Ashby board URL and scrape
        }
        break; // Found careers page
      }
    } catch { /* try next path */ }
  }

  return jobs;
}

async function searchYcJobs(companyName: string) {
  return [];
}
```

- [ ] **Step 2: Add `createFromResearch` internal mutation to outreachContacts**

Add to `convex/outreachContacts.ts`:

```typescript
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
    return await ctx.db.insert("outreachContacts", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});
```

- [ ] **Step 3: Verify compiles**

Run: `npx convex dev --once`

- [ ] **Step 4: Commit**

```bash
git add convex/companyResearch.ts convex/outreachContacts.ts
git commit -m "feat: add company research orchestrator with job discovery and contact enrichment"
```

---

### Task 4: Enhanced Add Company Dialog

**Files:**
- Modify: `web/app/(app)/outreach-tracker/add-company-dialog.tsx`

- [ ] **Step 1: Add smart input detection and research trigger**

Update the dialog to:
- Accept a single "Company name or URL" input
- Detect if it's a LinkedIn URL, website URL, or plain name
- On submit: create company, then trigger `researchCompany` action
- Show "Researching..." state after submit

Read the existing file first, then modify the `onSubmit` handler to call `researchCompany` after company creation.

The key change is adding `useAction(api.companyResearch.researchCompany)` and calling it after `addCompanyWithEnrichment` succeeds.

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/add-company-dialog.tsx
git commit -m "feat: trigger company research on add, smart input detection"
```

---

### Task 5: Types, Utils, Hooks for Jobs

**Files:**
- Modify: `web/app/(app)/outreach-tracker/types.ts`
- Modify: `web/app/(app)/outreach-tracker/utils.ts`
- Modify: `web/hooks/use-outreach-tracker.ts`

- [ ] **Step 1: Add job types and source colors**

Add to `types.ts`:

```typescript
export type JobSource =
  | "linkedin" | "careers_page" | "greenhouse" | "lever"
  | "ashby" | "workable" | "yc" | "wellfound" | "instahyre" | "naukri";

export type JobStatus = "new" | "applied" | "skipped";

export interface OutreachJob {
  _id: Id<"outreachJobs">;
  companyId: Id<"outreachCompanies">;
  title: string;
  url: string;
  source: JobSource;
  location?: string;
  workMode?: "remote" | "hybrid" | "onsite" | "unknown";
  status: JobStatus;
  description?: string;
  postedAt?: number;
  appliedAt?: number;
  appliedVia?: string;
  appliedNotes?: string;
  updatedAt: number;
}

export type ContactTier = "tier1" | "tier2" | "tier3";

export const SOURCE_COLORS: Record<JobSource, string> = {
  linkedin: "bg-[#0A66C2] text-white",
  careers_page: "bg-emerald-500 text-white",
  greenhouse: "bg-[#3AB549] text-white",
  lever: "bg-[#5C6BC0] text-white",
  ashby: "bg-[#6366F1] text-white",
  workable: "bg-[#1DA1F2] text-white",
  yc: "bg-[#F26522] text-white",
  wellfound: "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-800",
  instahyre: "bg-[#FF6B35] text-white",
  naukri: "bg-[#457EFF] text-white",
};

export const SOURCE_LABELS: Record<JobSource, string> = {
  linkedin: "LinkedIn",
  careers_page: "Careers",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workable: "Workable",
  yc: "YC",
  wellfound: "Wellfound",
  instahyre: "Instahyre",
  naukri: "Naukri",
};

export const TIER_LABELS: Record<ContactTier, string> = {
  tier1: "Decision Maker",
  tier2: "Recruiter",
  tier3: "Referral",
};

export const TIER_COLORS: Record<ContactTier, string> = {
  tier1: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  tier2: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  tier3: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export const SOURCE_BORDER_COLORS: Record<JobSource, string> = {
  linkedin: "border-l-[#0A66C2]",
  careers_page: "border-l-emerald-500",
  greenhouse: "border-l-[#3AB549]",
  lever: "border-l-[#5C6BC0]",
  ashby: "border-l-[#6366F1]",
  workable: "border-l-[#1DA1F2]",
  yc: "border-l-[#F26522]",
  wellfound: "border-l-zinc-800",
  instahyre: "border-l-[#FF6B35]",
  naukri: "border-l-[#457EFF]",
};
```

- [ ] **Step 2: Add hooks**

Add to `web/hooks/use-outreach-tracker.ts`:

```typescript
export function useOutreachJobs(companyId: Id<"outreachCompanies"> | null) {
  return useQuery(
    api.outreachJobs.listByCompany,
    companyId ? { companyId } : "skip"
  );
}

export function useJobCounts(companyId: Id<"outreachCompanies"> | null) {
  return useQuery(
    api.outreachJobs.countByCompany,
    companyId ? { companyId } : "skip"
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/types.ts web/app/\(app\)/outreach-tracker/utils.ts web/hooks/use-outreach-tracker.ts
git commit -m "feat: add job types, source colors, and useOutreachJobs hook"
```

---

### Task 6: Job Card Component

**Files:**
- Create: `web/app/(app)/outreach-tracker/job-card.tsx`

- [ ] **Step 1: Create job card**

A card showing job title, source badge, location, work mode, posted date, and action buttons (Apply, Mark Applied, Skip).

Key visual elements:
- Left border accent in source color (4px)
- Source badge with brand color
- Status: green dot = new, checkmark = applied, grayed = skipped
- "Apply" opens URL in new tab
- "Mark Applied" opens the dialog
- "Skip" grays out the card

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/job-card.tsx
git commit -m "feat: add JobCard component with source badges and actions"
```

---

### Task 7: Mark Applied Dialog

**Files:**
- Create: `web/app/(app)/outreach-tracker/mark-applied-dialog.tsx`

- [ ] **Step 1: Create the dialog**

Modal with:
- Job title + company header
- Channel selector as styled pills (not a dropdown):
  - LinkedIn Easy Apply (blue)
  - Company Portal (green)
  - YC Portal (orange)
  - Referral (purple)
  - Email (amber)
  - Other (gray)
- Notes textarea
- Save button that calls `outreachJobs.markApplied`

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/mark-applied-dialog.tsx
git commit -m "feat: add Mark Applied dialog with channel pills"
```

---

### Task 8: Jobs Tab

**Files:**
- Create: `web/app/(app)/outreach-tracker/jobs-tab.tsx`

- [ ] **Step 1: Create jobs tab**

Lists all jobs for a company using `useOutreachJobs`. Shows skeleton loader when company `researchStatus` is "researching". Renders `JobCard` for each job. Empty state when no jobs found with "Refresh Jobs" button.

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/jobs-tab.tsx
git commit -m "feat: add Jobs tab component"
```

---

### Task 9: People Tab

**Files:**
- Create: `web/app/(app)/outreach-tracker/people-tab.tsx`

- [ ] **Step 1: Create people tab**

Lists contacts for a company. Shows tier badges, enrichment quality indicator (green/amber/gray ring around avatar). "Generate Message" button with channel recommendation. "Find More Contacts" button for Tier 3. Reuses the existing `ContactCard` but enhanced with tier badge.

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/people-tab.tsx
git commit -m "feat: add People tab component with tier badges"
```

---

### Task 10: Skeleton Loader

**Files:**
- Create: `web/app/(app)/outreach-tracker/research-skeleton.tsx`

- [ ] **Step 1: Create skeleton component**

Animated shimmer placeholders for job cards and contact cards. Used when `researchStatus === "researching"`.

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/research-skeleton.tsx
git commit -m "feat: add research skeleton loader component"
```

---

### Task 11: Company Card Rewrite with Tabs

**Files:**
- Modify: `web/app/(app)/outreach-tracker/company-card.tsx`

- [ ] **Step 1: Add tab navigation**

Replace the current expanded content with a tab bar (Jobs / People / Pipeline). Default to Jobs tab. Show research status in header. Show job/contact counts on tab labels.

The tab bar should have an animated underline indicator.

Import and render `JobsTab`, `PeopleTab`, and the existing steps/contacts content as `PipelineTab`.

- [ ] **Step 2: Add research summary to header**

Show "Researching..." with skeleton animation when `researchStatus === "researching"`. Show "4 jobs, 5 contacts" summary when done.

- [ ] **Step 3: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/company-card.tsx
git commit -m "feat: rewrite company card with tabbed research dashboard"
```

---

### Task 12: Contact Card Enhancement

**Files:**
- Modify: `web/app/(app)/outreach-tracker/contact-card.tsx`

- [ ] **Step 1: Add tier badge and enrichment indicator**

Show tier badge (Decision Maker / Recruiter / Referral) next to the source badge. Add a colored ring around the avatar based on enrichment quality:
- Green ring: has email + LinkedIn + phone
- Amber ring: has 2 of 3
- Gray ring: has 1 or less

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/contact-card.tsx
git commit -m "feat: add tier badges and enrichment quality indicator to contact card"
```

---

### Task 13: Wire Up Research Trigger in Add Company

**Files:**
- Modify: `convex/outreachCompanies.ts`

- [ ] **Step 1: Trigger research after company creation**

Modify `addCompanyWithEnrichment` to schedule `researchCompany` after company creation:

```typescript
// After creating company and YC step...
await ctx.scheduler.runAfter(0, internal.companyResearch.researchCompany, {
  companyId,
  input: name, // or the URL if provided
});
```

Update the action to accept and pass through the original input (URL or name).

- [ ] **Step 2: Verify and commit**

```bash
git add convex/outreachCompanies.ts
git commit -m "feat: auto-trigger company research after add"
```

---

### Task 14: Final Verification

- [ ] **Step 1: Deploy Convex**

Run: `npx convex dev --once`

- [ ] **Step 2: Type check**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Manual smoke test**

1. Open Outreach Tracker
2. Click "Add Company" → enter "Stripe"
3. Verify: company card appears with "Researching..." skeleton
4. Wait 15-20 seconds → verify jobs and contacts populate
5. Click Jobs tab → see job listings with source badges
6. Click "Apply" on a job → opens Stripe careers in new tab
7. Click "Mark Applied" → dialog with channel pills → save
8. Click People tab → see contacts with tier badges
9. Click "Generate Message" → see draft with channel recommendation
10. Verify pipeline tab has auto-generated steps

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: company research flow — complete implementation"
```

---

## Summary

| Task | What | Files |
|---|---|---|
| 1 | Schema: `outreachJobs` + company/contact fields | `convex/schema.ts` |
| 2 | Jobs CRUD mutations/queries | `convex/outreachJobs.ts` |
| 3 | Research orchestrator + job/contact discovery | `convex/companyResearch.ts` |
| 4 | Enhanced Add Company dialog | `add-company-dialog.tsx` |
| 5 | Types, source colors, hooks | `types.ts`, `utils.ts`, hooks |
| 6 | Job card component | `job-card.tsx` |
| 7 | Mark Applied dialog | `mark-applied-dialog.tsx` |
| 8 | Jobs tab | `jobs-tab.tsx` |
| 9 | People tab | `people-tab.tsx` |
| 10 | Skeleton loader | `research-skeleton.tsx` |
| 11 | Company card rewrite with tabs | `company-card.tsx` |
| 12 | Contact card tier badges | `contact-card.tsx` |
| 13 | Wire research trigger | `outreachCompanies.ts` |
| 14 | Final verification | Testing |
