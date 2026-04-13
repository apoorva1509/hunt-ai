# Company Hub + LinkedIn Connection Tracker

**Date:** 2026-04-13
**Status:** Approved
**Author:** Apoorva + Claude

## Problem

User sends 20-30 LinkedIn connection requests daily across recruiters, hiring managers, founders, and peers. No way to:
- Track which requests were accepted
- Know which requests were sent without a note (and need a follow-up message)
- See a unified view of all activity per company (applications, connections, outreach)
- Get agent-driven follow-up suggestions

## Constraints

- **Zero LinkedIn risk** — no API calls, no scraping, no automation of LinkedIn itself
- **Minimal manual work** — agents handle research, drafting, reminders; user just confirms
- **Unified company view** — one place to see applications, connections, outreach, next steps

## Design

### 1. Schema: New `connectionRequests` Table

Added to `convex/schema.ts`:

```typescript
connectionRequests: defineTable({
  agentId: v.id("agents"),
  personId: v.id("people"),
  companyId: v.id("companies"),
  contactRole: v.string(),            // free text: "Sr. Recruiter", "CTO", etc.
  contactType: v.union(
    v.literal("recruiter"),
    v.literal("hiring_manager"),
    v.literal("peer"),
    v.literal("founder"),
    v.literal("executive"),
    v.literal("other")
  ),
  sentDate: v.number(),
  status: v.union(
    v.literal("suggested"),          // agent-discovered, not yet reached out
    v.literal("pending"),            // connection request sent, awaiting response
    v.literal("accepted"),
    v.literal("ignored")
  ),
  noteWithRequest: v.boolean(),       // sent a note with the connection request?
  messageSent: v.boolean(),           // sent a follow-up message after?
  messageDate: v.optional(v.number()),
  linkedToLeadId: v.optional(v.id("agentItems")),  // link to job_lead if exists
  notes: v.optional(v.string()),
  updatedAt: v.number(),
})
  .index("by_agent", ["agentId"])
  .index("by_company", ["companyId"])
  .index("by_agent_and_status", ["agentId", "status"])
  .index("by_agent_and_company", ["agentId", "companyId"])
```

### 2. Schema Extension: Application Channel

Add optional `applicationChannel` to `agentItems.data` for `job_lead` items to track how the user applied:

- `linkedin_easy_apply`
- `company_portal`
- `referral`
- `email`
- `other`

This is stored in the existing `data: v.any()` field, no schema migration needed.

### 3. Agent Automation

| Trigger | Agent Action |
|---------|-------------|
| Job offer evaluated | Web-search 3-5 target contacts at the company (name, role, LinkedIn URL). Create `people` records with status "suggested" (not yet reached out). |
| Outreach draft marked "sent" | Auto-create `connectionRequests` record linked to the company + lead. |
| User says "sent requests to: [list]" | Bulk-create `people` + `connectionRequests`, match to existing companies or create new ones. |
| Daily scheduled run | Review all `pending` connections older than 3 days. Generate follow-up message drafts for those without notes. Flag in "Next Steps". |
| Connection marked "accepted" | Draft a thank-you / next-step message using the job context. |
| Company appears in both leads and connections | Auto-link via `companyId`. Unified view is automatic. |

### 4. UI: Company Hub

#### 4a. Companies List Page (`/companies`)

New sidebar item: **Companies** (icon: `Building2` from lucide).

List view showing all companies the user has interacted with, sorted by most recent activity:

```
Company Name | Roles Applied | Connections | Status | Last Activity
Stripe       | 1             | 3 (1 acc.)  | Interview | 2d ago
Google       | 2             | 1 (1 acc.)  | Applied   | 5d ago
```

Filters: All | Active (has pending connections or open applications) | Archived

#### 4b. Company Detail Page (`/companies/[id]`)

Five sections, top to bottom:

**Section 1: Next Steps (agent-generated)**
- Actionable items surfaced by the agent: follow-ups needed, messages to send, interviews to prep for
- Each item has: description, [Draft ready] / [Mark done] / [Skip] buttons
- Sorted by urgency (oldest pending first, accepted needing reply second)

**Section 2: Applications**
- All `job_lead` agentItems linked to this company
- Shows: role title, date, score, application channel (LinkedIn/Portal/etc.), status
- Links to report and resume PDF

**Section 3: Connections**
- All `connectionRequests` for this company
- Shows: name, role, type badge, status (pending/accepted/ignored), note sent?, message sent?
- Visual flags: warning icon for "no note + pending > 3 days"
- Suggested contacts (from agent research) shown at bottom with [Reach Out] button
- [+ Add] button for manual quick-add

**Section 4: Activity Timeline**
- Chronological feed of all events: evaluations, applications, connection requests sent, messages sent, status changes
- Combines data from `agentItems`, `connectionRequests`, and `agentRuns`

**Section 5: Company Intel (collapsed by default)**
- Employee count, location, industry, funding stage
- From `companies` table fields

### 5. Quick-Add & Daily Check-in

#### Quick-Add (Web UI)
Floating [+] button on Companies/Connections. Modal with:
- Name (text)
- Company (autocomplete from existing companies)
- Role title (text)
- Type (dropdown: recruiter/hiring_manager/peer/founder/executive/other)
- Sent note? (toggle, default: false)

4-5 fields, target under 5 seconds per entry.

#### Daily Check-in Mode (`modes/checkin.md`)

CLI mode invoked via `/career-ops checkin`. Two flows:

**Flow 1: Status update (review pending connections)**
```
Agent: "18 pending connections from 3+ days ago. Quick status check:
        1. Jane D. @ Stripe (Recruiter, sent 04/08)
        2. Bob K. @ Stripe (Eng Mgr, sent 04/08)
        ..."
User:  "1 accepted, 3 accepted, rest skip"
Agent: [Updates, drafts follow-ups for accepted]
```

**Flow 2: Log new requests**
```
User:  "sent today: John CTO Acme, Sarah recruiter Bolt, Mike eng Stripe"
Agent: [Parses, creates/matches companies, creates people + connection records]
       "Created 3 connections. Stripe already has 2 other connections — linked."
```

#### Scheduled Agent Run
Daily agent run (via existing `agentRuns` system) that:
1. Flags pending connections > 3 days old
2. Generates follow-up drafts for flagged connections
3. Produces a summary notification / "Next Steps" items on relevant company pages

### 6. New Files

| File | Purpose |
|------|---------|
| `convex/connectionRequests.ts` | CRUD mutations/queries for connection requests |
| `web/app/(app)/companies/page.tsx` | Companies list page |
| `web/app/(app)/companies/[id]/page.tsx` | Company detail page |
| `web/components/connections/connection-card.tsx` | Connection row component |
| `web/components/connections/quick-add-modal.tsx` | Quick-add modal |
| `web/components/connections/types.ts` | TypeScript types for connections |
| `web/components/next-steps/next-steps-panel.tsx` | Agent-generated next steps |
| `web/components/next-steps/types.ts` | TypeScript types for next steps |
| `web/components/company/activity-timeline.tsx` | Timeline component |
| `web/components/company/applications-section.tsx` | Applications section |
| `web/components/company/types.ts` | TypeScript types for company hub |
| `web/hooks/use-connection-requests.ts` | React hook for connection data |
| `web/hooks/use-company-detail.ts` | React hook for company detail aggregation |
| `modes/checkin.md` | CLI check-in mode |
| Update `web/components/layout/sidebar.tsx` | Add Companies nav item |
| Update `convex/schema.ts` | Add connectionRequests table |

### 7. Integration with Existing Career-Ops

- The `contacto` mode (LinkedIn Power Move) already generates outreach messages. After the user marks a draft as "sent" in the Outreach page, a connection request record is auto-created.
- The `tracker` mode reads `data/applications.md`. The Company Hub reads from Convex. These are separate data sources; the Company Hub is the richer, real-time view. Over time, Convex becomes the source of truth.
- Companies discovered via portal scanning (`/career-ops scan`) auto-create `companies` records in Convex, so they appear in the Companies list even before any outreach.

### 8. Out of Scope

- LinkedIn API integration (zero risk policy)
- Browser extension for auto-detecting acceptance (future consideration)
- Email outreach tracking (can be added later using same pattern)
- Mobile app / responsive design (web-first)
