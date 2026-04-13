# Company Research Flow — One-Click Job Discovery + Contact Outreach

**Date:** 2026-04-12
**Status:** Draft
**Approach:** Enrich-Then-Display (single action, all results at once)

## Problem

User is aggressively job searching and needs a fast way to go from "company name" to "applied + messaged decision makers" with minimal clicks. Current system has the backend pieces (company enrichment, contact enrichment, message generation) but no unified flow connecting them.

## Requirements

| Requirement | Detail |
|---|---|
| Input | Company name, LinkedIn company URL, or website URL |
| Entry point | Enhanced "Add Company" dialog in Outreach Tracker |
| Job discovery | LinkedIn, careers page, Greenhouse, Lever, Ashby, Workable, YC, Wellfound, Instahyre, Naukri |
| Contact discovery | Tier 1 (hiring authority) + Tier 2 (recruiters) automatic. Tier 3 (referrals) on-demand via button. |
| Contact enrichment | Apollo → Apify → Hunter.io → RocketReach → LinkedIn scrape (waterfall) |
| Message generation | Auto-recommend channel (LinkedIn DM / email / connection request) with reasoning. One-click generate. |
| Follow-ups | Existing follow-up system (2-day reminders, auto-stop on reply) |
| "Mark Applied" | Logs application with channel + notes, creates outreach message, marks pipeline step done |
| UI | Polished — gradient borders, skeleton loaders, source badges, animated toasts |

## Architecture

```
User adds company (name / URL)
        │
        ▼
┌─────────────────────────────┐
│  researchCompany (action)   │
│                             │
│  Step 1: Resolve identity   │
│    Clearbit, YC check,      │
│    find LinkedIn page       │
│                             │
│  Step 2: Discover jobs      │  ← parallel
│    LinkedIn, careers page,  │
│    ATS boards, YC, portals  │
│                             │
│  Step 3: Find contacts      │  ← parallel with Step 2
│    Apollo → Apify →         │
│    Hunter.io → RocketReach  │
│    → LinkedIn scrape        │
│                             │
│  Step 4: Save all results   │
│    outreachJobs (new table) │
│    outreachContacts          │
│    outreachSteps (auto)     │
│                             │
│  Step 5: Notify UI          │
│    Toast with counts        │
└─────────────────────────────┘
        │
        ▼
Company card expands with 3 tabs:
  Jobs │ People │ Pipeline
```

## Data Model

### New Table: `outreachJobs`

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
  description: v.optional(v.string()),   // truncated to 2000 chars
  postedAt: v.optional(v.number()),
  appliedAt: v.optional(v.number()),
  appliedVia: v.optional(v.string()),    // "linkedin_easy_apply" | "company_portal" | "yc" | "referral" | "email"
  appliedNotes: v.optional(v.string()),
  updatedAt: v.number(),
})
  .index("by_company", ["companyId"])
  .index("by_status", ["status"])
  .index("by_company_and_status", ["companyId", "status"])
```

### Modified: `outreachCompanies`

Add fields from enrichment:

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
researchSummary: v.optional(v.string()),  // "4 jobs, 5 contacts found"
```

### Modified: `outreachContacts`

Add tier field:

```typescript
tier: v.optional(v.union(
  v.literal("tier1"),  // hiring authority
  v.literal("tier2"),  // recruiter/talent
  v.literal("tier3")   // referral (peer)
)),
```

## Component 1: Enhanced Add Company Dialog

**File:** `web/app/(app)/outreach-tracker/add-company-dialog.tsx`

Current: name + website URL + role fields.

Enhanced:
- Single smart input that detects: company name, LinkedIn URL (`/company/`), website URL, careers page URL
- Auto-detects input type and fills appropriate fields
- "Research" button (instead of "Add") — communicates that enrichment will happen
- After submit: dialog closes, company card appears with skeleton loader showing "Researching..."

## Component 2: `researchCompany` Convex Action

**File:** `convex/companyResearch.ts`

Single action that orchestrates all enrichment. Uses `ctx.scheduler.runAfter` for parallel steps.

### Step 1: Resolve Company Identity

```
Input → detect type:
  - LinkedIn URL → extract company slug → scrape company page for name, domain, description
  - Website URL → extract domain → Clearbit enrichment
  - Company name → Clearbit name search → get domain → enrich

Output: name, domain, logoUrl, description, employeeCount, industry, linkedinUrl, careersUrl, isYcBacked
```

### Step 2: Discover Jobs (parallel)

Each source is a separate internal action, all scheduled at once:

**LinkedIn Jobs:**
- Apify "LinkedIn Jobs Scraper" actor with company name filter
- Extract: title, location, URL, posted date

**Careers Page:**
- Fetch `{domain}/careers`, `/jobs`, `/careers/openings`
- Detect ATS: look for Greenhouse (`boards.greenhouse.io`), Lever (`jobs.lever.co`), Ashby (`jobs.ashby.io`), Workable (`apply.workable.com`)
- If ATS detected → use their public API to list jobs

**YC (if YC-backed):**
- Scrape `ycombinator.com/companies/{slug}/jobs`

**Wellfound:**
- Scrape `wellfound.com/company/{slug}/jobs`

**Instahyre / Naukri:**
- Search by company name, extract matching listings

All jobs are deduplicated by title + source before saving.

### Step 3: Find Contacts (parallel with Step 2)

**Tier 1 — Hiring Authority:**
Titles to search: CTO, VP Engineering, Head of Engineering, Director of Engineering, Engineering Manager, Senior Engineering Manager, Chief Product Officer, VP Product, Founder, CEO, Co-founder (last three only if employeeCount < 100)

**Tier 2 — Gatekeepers:**
Titles to search: Recruiter, Senior Recruiter, Lead Recruiter, Talent Acquisition Manager, Head of Talent, HR Manager, People Operations, Technical Recruiter

**Enrichment waterfall per contact:**
1. Apollo API → name, title, email, phone, LinkedIn URL, profile picture
2. Apify LinkedIn Profile Scraper → headline, profile picture (if Apollo missed)
3. Hunter.io → email by domain (if Apollo had no email)
4. RocketReach → phone (if Apollo had no phone)
5. LinkedIn public scrape → profile picture, headline (final fallback)

Deduplicate by email or LinkedIn URL. Save with tier tag.

### Step 4: Save Results

- Insert all jobs into `outreachJobs`
- Insert all contacts into `outreachContacts` (skip if already exists by email/LinkedIn URL)
- Auto-create pipeline steps:
  - "Apply on LinkedIn" (if LinkedIn jobs found)
  - "Apply on company portal" (if careers URL found)
  - "Apply via YC portal" (if YC-backed)
  - "Send cold emails" (if any contact has email)
  - "Send LinkedIn DMs" (if any contact has LinkedIn URL)
- Update company `researchStatus` → "done", `researchSummary` → "X jobs, Y contacts"

### Step 5: Notify

Update `researchStatus` so the UI's reactive query shows results. Toast notification fires on the frontend via the query update.

## Component 3: Company Card UI — Tabbed Research Dashboard

**File:** `web/app/(app)/outreach-tracker/company-card.tsx` (major enhancement)

### Header (always visible, collapsed or expanded)

- Logo (large, 48px) + company name + badges row (YC orange, funding stage, employee count)
- One-line description
- Icon links: website, LinkedIn, careers page
- Status pills: Active / Paused / Closed
- Research status: skeleton animation while "researching", summary text when done ("4 jobs, 5 contacts")
- Progress bar for pipeline steps (existing)

### Expanded: Three Tabs

**Tab 1: "Jobs" (default tab)**

Job cards in a grid (2 columns on desktop, 1 on mobile):

Each card:
- Left accent border colored by source (LinkedIn blue, YC orange, Greenhouse green, etc.)
- Title (bold), location + work mode badge
- Source badge with brand color (small, pill-shaped)
- Posted date (relative: "2d ago")
- Status indicator: green dot = new, gray = applied, red = skipped

Card actions:
- **"Apply"** button → opens job URL in new tab
- **"Mark Applied"** button → opens "Applied" dialog:
  - Channel dropdown: LinkedIn Easy Apply, Company Portal, YC Portal, Referral, Email, Other
  - Notes textarea (optional)
  - On submit: marks job applied, logs outreach message, marks pipeline step done
- **"Skip"** button → marks as skipped (grayed out)
- Expandable JD preview (click to show full description, truncated by default)

Empty state: "No open positions found" + "Refresh Jobs" button

**Tab 2: "People"**

Contact cards in a list:

Each card:
- Profile photo (or initial avatar), name, title, headline
- Tier badge: "Decision Maker" (purple) or "Recruiter" (blue)
- Contact info row: LinkedIn icon (clickable, blue), Email icon (clickable, amber), Phone icon (clickable, green) — grayed out + tooltip "Not found" if missing
- **"Generate Message"** button → calls Claude to generate message with auto-recommended channel + reasoning
  - Shows: recommended channel, draft message, reasoning line
  - Buttons: "Copy", "Copy & Open LinkedIn", "Log as Sent"
- If messages exist: shows last message date + "Follow Up" button
- Follow-up badge (orange) if overdue (from existing reminder system)

Bottom of tab:
- **"Find More Contacts"** button (Tier 3 — peers/referrals) — only appears if not already loaded

Empty state: "No contacts found" + "Retry Search" button

**Tab 3: "Pipeline"**

Existing step checklist UI, auto-populated with the steps created during research. Compact view — this tab is secondary.

### Visual Design Details

- Tab bar with underline indicator (animated slide)
- Skeleton loaders during research: card-shaped placeholders with shimmer animation
- Source badges: LinkedIn (#0A66C2), YC (#F26522), Greenhouse (#3AB549), Lever (#5C6BC0), Ashby (#6366F1), Workable (#1DA1F2), Wellfound (#000), Instahyre (#FF6B35), Naukri (#457EFF)
- Job card borders: subtle left accent line (4px) in source color
- Contact enrichment quality indicator: green ring around avatar = full info (email + phone + LinkedIn), amber = partial, gray = LinkedIn only
- Toast notifications (bottom-right): slide-in with progress, auto-dismiss after 4s
- "Applied" cards get a subtle green background tint + checkmark overlay

## Component 4: Message Generation Enhancement

**File:** `convex/outreach.ts` (modify existing)

Enhance the existing `generate` action to:
1. Accept a `contactId` from `outreachContacts` (not just `agentItems`)
2. Auto-recommend the best channel based on:
   - Has email? → email is reliable
   - Has LinkedIn? → LinkedIn DM or connection request
   - No email, has LinkedIn? → LinkedIn connection request
   - Has phone? → mention as secondary option
3. Return: `{ channel, message, subject (for email), reasoning }`

The prompt includes:
- Contact's title and company context
- Job they might be hiring for (from `outreachJobs`)
- User's CV summary (from profile)
- Any existing conversation history

## Component 5: "Mark Applied" Dialog

**File:** `web/app/(app)/outreach-tracker/mark-applied-dialog.tsx` (new)

Modal with:
- Job title + company (read-only header)
- Channel selector (styled pills, not boring dropdown):
  - LinkedIn Easy Apply (blue)
  - Company Portal (green)
  - YC Portal (orange)
  - Referral (purple)
  - Email (amber)
  - Other (gray)
- Notes textarea
- "Save" button

On save:
1. Update `outreachJobs` status → "applied", set `appliedAt`, `appliedVia`, `appliedNotes`
2. Create `outreachMessage` with channel mapped to message channel, direction "outbound"
3. Find matching pipeline step (e.g., "Apply on LinkedIn") → mark as done
4. Toast: "Logged application at {company}"

## Component 6: Convex Functions

### New File: `convex/outreachJobs.ts`

**Queries:**
- `listByCompany` — all jobs for a company
- `listByCompanyAndStatus` — filtered by status
- `countByCompany` — job counts for summary

**Mutations:**
- `create` — insert job (used by research action)
- `markApplied` — set status, appliedAt, appliedVia, appliedNotes + auto-mark pipeline step
- `markSkipped` — set status to skipped
- `batchCreate` — insert multiple jobs (used by research action)

### New File: `convex/companyResearch.ts`

**Action:** `researchCompany` — the orchestrator described in Component 2

**Internal actions (one per source):**
- `discoverLinkedInJobs` — Apify LinkedIn Jobs Scraper
- `discoverCareersPage` — scrape + ATS detection
- `discoverYcJobs` — YC job scraper
- `discoverWellfoundJobs` — Wellfound scraper
- `discoverPortalJobs` — Instahyre, Naukri
- `findContacts` — Apollo + waterfall enrichment
- `findTier3Contacts` — on-demand peer/referral search

### Modified: `convex/outreachCompanies.ts`

- `addCompanyWithEnrichment` → enhanced to accept LinkedIn URL input, trigger `researchCompany`

## File Inventory

### New Files

| File | Purpose |
|---|---|
| `convex/outreachJobs.ts` | CRUD for jobs table |
| `convex/companyResearch.ts` | Research orchestrator + per-source scrapers |
| `web/app/(app)/outreach-tracker/jobs-tab.tsx` | Jobs tab UI with cards |
| `web/app/(app)/outreach-tracker/people-tab.tsx` | People/contacts tab UI |
| `web/app/(app)/outreach-tracker/mark-applied-dialog.tsx` | "Mark Applied" modal |
| `web/app/(app)/outreach-tracker/job-card.tsx` | Individual job card component |
| `web/app/(app)/outreach-tracker/research-skeleton.tsx` | Skeleton loader for research state |

### Modified Files

| File | Change |
|---|---|
| `convex/schema.ts` | Add `outreachJobs` table, new fields on `outreachCompanies` and `outreachContacts` |
| `convex/outreachCompanies.ts` | Enhanced `addCompanyWithEnrichment` to trigger research |
| `convex/outreach.ts` | Enhanced `generate` to work with outreachContacts directly + channel recommendation |
| `web/app/(app)/outreach-tracker/company-card.tsx` | Complete rewrite with tabs (Jobs/People/Pipeline) |
| `web/app/(app)/outreach-tracker/add-company-dialog.tsx` | Smart input detection, "Research" button |
| `web/app/(app)/outreach-tracker/contact-card.tsx` | Add tier badge, enrichment quality indicator |
| `web/app/(app)/outreach-tracker/types.ts` | New types for jobs, research status, tiers |
| `web/app/(app)/outreach-tracker/utils.ts` | Source colors, tier labels |
| `web/hooks/use-outreach-tracker.ts` | Add `useOutreachJobs` hook |

## API Keys Required

| Service | Free Tier | What it provides |
|---|---|---|
| Apollo | 50 credits/month | Emails, phones, titles, LinkedIn URLs |
| Apify | $5 free credit | LinkedIn job scraping, profile scraping |
| Hunter.io | 25 searches/month | Email finder by domain |
| RocketReach | 5 lookups/month | Emails + phone numbers |
| Clearbit | Logo API (free) | Company logos |
| Anthropic | Pay per use | Message generation (Claude Haiku) |

Keys stored in Convex agent secrets (existing `agentSecrets` table).

## Edge Cases

- **Company not found by Clearbit:** Fall back to LinkedIn scrape for basic info
- **No jobs found on any source:** Show "No open positions found" with careers page link if available
- **Apollo rate limit hit:** Continue with other sources, show partial results
- **Duplicate contacts across sources:** Deduplicate by email first, then LinkedIn URL, then name
- **User adds same company twice:** Check by domain before creating, show existing if found
- **Research action timeout:** Convex actions have 10min limit. Each source scraper is a separate scheduled function, so partial results save even if some sources fail.
- **ATS board scraping fails:** Log error, skip source, continue with others

## Out of Scope

- Automated application submission (user always clicks apply manually)
- Resume tailoring per job (separate feature)
- Salary data extraction
- Interview scheduling
- Multi-user / team features
