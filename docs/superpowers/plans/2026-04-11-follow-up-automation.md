# Follow-up Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automated 2-day follow-up reminders with browser notifications, Gmail sync/draft creation, and a minimal Chrome extension for LinkedIn message pasting.

**Architecture:** Convex cron scans contacts every 6 hours, creates reminder records for overdue follow-ups. Web UI shows badges and fires browser push notifications. Gmail MCP runner syncs sent emails and creates drafts. Chrome extension injects a paste button on LinkedIn messaging pages.

**Tech Stack:** Convex (backend, cron), Next.js (web UI, Notification API), Node.js runner (Gmail MCP), Chrome Extension Manifest V3

**Spec:** `docs/superpowers/specs/2026-04-11-follow-up-automation-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `convex/followUpReminders.ts` | Queries + mutations for follow-up reminder CRUD |
| `convex/followUpCron.ts` | Internal mutation that scans contacts and creates/dismisses reminders |
| `convex/crons.ts` | Convex cron job registration (runs followUpCron every 6 hours) |
| `web/hooks/use-follow-up-notifications.ts` | React hook: subscribes to reminders, fires browser notifications |
| `web/app/(app)/outreach-tracker/follow-up-badge.tsx` | Reusable badge component for overdue indicators |
| `runner/gmail-sync/index.ts` | Gmail MCP sync script: reads sent/received emails, creates drafts |
| `runner/gmail-sync/convex-client.ts` | Convex HTTP client for Gmail runner |
| `extension/manifest.json` | Chrome extension manifest (Manifest V3) |
| `extension/content.js` | LinkedIn paste content script (~50 lines) |

### Modified Files

| File | Change |
|---|---|
| `convex/schema.ts` | Add `followUpReminders` table, new fields on `outreachContacts` and `outreachMessages` |
| `convex/outreachContacts.ts` | Add `stopFollowUp` mutation, accept `followUpEnabled`/`followUpStoppedReason` in `update` |
| `convex/outreachMessages.ts` | After `create`: auto-mark reminders as acted (outbound) or auto-stop follow-ups (inbound), accept `gmailMessageId`/`gmailThreadId` |
| `convex/outreachCompanies.ts` | After `update` to status `"closed"`: auto-stop follow-ups for all contacts |
| `web/app/(app)/outreach-tracker/types.ts` | Add `FollowUpReminder` interface, `FollowUpStoppedReason` type |
| `web/app/(app)/outreach-tracker/utils.ts` | Add `isOverdue` helper |
| `web/app/(app)/outreach-tracker/contact-card.tsx` | Show overdue badge, follow-up action buttons (generate, send via LinkedIn, create Gmail draft, dismiss, stop) |
| `web/app/(app)/outreach-tracker/page.tsx` | Show overdue count badge in header |
| `web/hooks/use-outreach-tracker.ts` | Add `useFollowUpReminders` hook |

---

### Task 1: Schema Changes

**Files:**
- Modify: `convex/schema.ts:288-370`

- [ ] **Step 1: Add `followUpEnabled` and `followUpStoppedReason` to `outreachContacts`**

In `convex/schema.ts`, add two fields to the `outreachContacts` table definition (after the `apolloData` field, before `updatedAt`):

```typescript
  outreachContacts: defineTable({
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
    followUpEnabled: v.optional(v.boolean()),
    followUpStoppedReason: v.optional(
      v.union(
        v.literal("manual"),
        v.literal("replied"),
        v.literal("closed")
      )
    ),
    updatedAt: v.number(),
  })
    .index("by_company", ["companyId"]),
```

- [ ] **Step 2: Add `gmailMessageId` and `gmailThreadId` to `outreachMessages`**

In `convex/schema.ts`, add two fields and a new index to the `outreachMessages` table:

```typescript
  outreachMessages: defineTable({
    contactId: v.id("outreachContacts"),
    companyId: v.id("outreachCompanies"),
    channel: v.union(
      v.literal("linkedin_dm"),
      v.literal("linkedin_connection"),
      v.literal("email"),
      v.literal("whatsapp")
    ),
    body: v.string(),
    sentAt: v.number(),
    direction: v.union(v.literal("outbound"), v.literal("inbound")),
    gmailMessageId: v.optional(v.string()),
    gmailThreadId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_contact", ["contactId"])
    .index("by_company", ["companyId"])
    .index("by_gmail_message_id", ["gmailMessageId"]),
```

- [ ] **Step 3: Add `followUpReminders` table**

Add the new table at the end of the schema (before the closing `});`):

```typescript
  followUpReminders: defineTable({
    contactId: v.id("outreachContacts"),
    companyId: v.id("outreachCompanies"),
    channel: v.union(
      v.literal("linkedin_dm"),
      v.literal("linkedin_connection"),
      v.literal("email")
    ),
    dueAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("notified"),
      v.literal("acted"),
      v.literal("dismissed")
    ),
    lastOutboundMessageId: v.optional(v.id("outreachMessages")),
    updatedAt: v.number(),
  })
    .index("by_contact", ["contactId"])
    .index("by_status", ["status"])
    .index("by_company", ["companyId"])
    .index("by_due", ["dueAt"]),
```

- [ ] **Step 4: Verify schema compiles**

Run: `cd /Users/apoorva1509/conductor/workspaces/career-ops-v1/seville && npx convex dev --once 2>&1 | head -20`

Expected: Schema pushes successfully, no errors.

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add followUpReminders table and follow-up fields to schema"
```

---

### Task 2: Follow-Up Reminders CRUD (`convex/followUpReminders.ts`)

**Files:**
- Create: `convex/followUpReminders.ts`

- [ ] **Step 1: Create the file with queries and mutations**

```typescript
import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentPerson } from "./helpers/auth";

const reminderStatusValidator = v.union(
  v.literal("pending"),
  v.literal("notified"),
  v.literal("acted"),
  v.literal("dismissed")
);

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

    return [...pending, ...notified].filter((r) => companyIds.has(r.companyId)).length;
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

// Used by the cron job and by outreachMessages.create
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

// Dismiss all active reminders for a contact (used when follow-ups are stopped)
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

// Mark all active reminders as acted for a contact (used when a new message is logged)
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/apoorva1509/conductor/workspaces/career-ops-v1/seville && npx convex dev --once 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add convex/followUpReminders.ts
git commit -m "feat: add followUpReminders CRUD queries and mutations"
```

---

### Task 3: Follow-Up Cron Job (`convex/followUpCron.ts` + `convex/crons.ts`)

**Files:**
- Create: `convex/followUpCron.ts`
- Create: `convex/crons.ts`

- [ ] **Step 1: Create the cron logic**

Create `convex/followUpCron.ts`:

```typescript
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export const checkAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get all active companies (across all users)
    const companies = await ctx.db.query("outreachCompanies").collect();
    const activeCompanies = companies.filter((c) => c.status === "active");

    for (const company of activeCompanies) {
      const contacts = await ctx.db
        .query("outreachContacts")
        .withIndex("by_company", (q) => q.eq("companyId", company._id))
        .collect();

      for (const contact of contacts) {
        // Skip if follow-ups disabled
        if (contact.followUpEnabled === false) continue;

        // Get latest message for this contact
        const messages = await ctx.db
          .query("outreachMessages")
          .withIndex("by_contact", (q) => q.eq("contactId", contact._id))
          .order("desc")
          .take(1);

        const latestMessage = messages[0];
        if (!latestMessage) continue; // No outreach started yet

        // Auto-stop if latest message is inbound (they replied)
        if (latestMessage.direction === "inbound") {
          await ctx.db.patch(contact._id, {
            followUpEnabled: false,
            followUpStoppedReason: "replied",
            updatedAt: now,
          });
          await ctx.scheduler.runAfter(0, internal.followUpReminders.dismissAllForContact, {
            contactId: contact._id,
          });
          continue;
        }

        // Check if follow-up is overdue
        const dueAt = latestMessage.sentAt + TWO_DAYS_MS;
        if (dueAt >= now) continue; // Not overdue yet

        // Check if an active reminder already exists
        const existingReminders = await ctx.db
          .query("followUpReminders")
          .withIndex("by_contact", (q) => q.eq("contactId", contact._id))
          .collect();

        const hasActiveReminder = existingReminders.some(
          (r) => r.status === "pending" || r.status === "notified"
        );

        if (hasActiveReminder) continue; // Already has a reminder

        // Determine channel from last outbound message (exclude whatsapp from reminders)
        let channel: "linkedin_dm" | "linkedin_connection" | "email";
        if (
          latestMessage.channel === "linkedin_dm" ||
          latestMessage.channel === "linkedin_connection" ||
          latestMessage.channel === "email"
        ) {
          channel = latestMessage.channel;
        } else {
          // whatsapp fallback — default to linkedin_dm
          channel = "linkedin_dm";
        }

        // Create reminder
        await ctx.scheduler.runAfter(0, internal.followUpReminders.createReminder, {
          contactId: contact._id,
          companyId: company._id,
          channel,
          dueAt,
          lastOutboundMessageId: latestMessage._id,
        });
      }
    }
  },
});
```

- [ ] **Step 2: Create the cron registration**

Create `convex/crons.ts`:

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "check follow-ups",
  { hours: 6 },
  internal.followUpCron.checkAll
);

export default crons;
```

- [ ] **Step 3: Verify both files compile**

Run: `cd /Users/apoorva1509/conductor/workspaces/career-ops-v1/seville && npx convex dev --once 2>&1 | head -20`

Expected: Cron registered, no errors.

- [ ] **Step 4: Commit**

```bash
git add convex/followUpCron.ts convex/crons.ts
git commit -m "feat: add follow-up cron job (checks every 6 hours, creates reminders)"
```

---

### Task 4: Auto-Stop Follow-Ups on Message Create and Company Close

**Files:**
- Modify: `convex/outreachMessages.ts:39-55`
- Modify: `convex/outreachContacts.ts:49-68`
- Modify: `convex/outreachCompanies.ts:79-101`

- [ ] **Step 1: Update `outreachMessages.create` to handle follow-up side effects**

In `convex/outreachMessages.ts`, add the import and update the `create` mutation:

```typescript
import { mutation, query } from "./_generated/server";
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
```

Replace the `create` mutation handler (lines 39-55) with:

```typescript
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
      // Mark any pending reminders as acted
      await ctx.scheduler.runAfter(
        0,
        internal.followUpReminders.markActedForContact,
        { contactId: args.contactId }
      );
    } else if (args.direction === "inbound") {
      // Auto-stop follow-ups: they replied
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
```

- [ ] **Step 2: Add `stopFollowUp` mutation to `outreachContacts.ts`**

Add this mutation at the end of `convex/outreachContacts.ts` (before `enrichFromLinkedin`):

```typescript
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
```

Also add `followUpEnabled` and `followUpStoppedReason` to the `update` mutation args:

```typescript
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
```

Also add the `internal` import at the top of the file:

```typescript
import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { requirePerson } from "./helpers/auth";
import { api, internal } from "./_generated/api";
```

- [ ] **Step 3: Auto-stop follow-ups when company is closed**

In `convex/outreachCompanies.ts`, update the `update` mutation (lines 79-101) to add cascade logic:

```typescript
export const update = mutation({
  args: {
    id: v.id("outreachCompanies"),
    name: v.optional(v.string()),
    domain: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    isYcBacked: v.optional(v.boolean()),
    fundingStage: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(statusValidator),
    roleAppliedFor: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requirePerson(ctx);
    const patch: Record<string, any> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(id, patch);

    // Auto-stop follow-ups for all contacts when company is closed
    if (fields.status === "closed") {
      const contacts = await ctx.db
        .query("outreachContacts")
        .withIndex("by_company", (q) => q.eq("companyId", id))
        .collect();
      const now = Date.now();
      for (const contact of contacts) {
        if (contact.followUpEnabled !== false) {
          await ctx.db.patch(contact._id, {
            followUpEnabled: false,
            followUpStoppedReason: "closed",
            updatedAt: now,
          });
          await ctx.scheduler.runAfter(
            0,
            internal.followUpReminders.dismissAllForContact,
            { contactId: contact._id }
          );
        }
      }
    }
  },
});
```

Add `internal` to the import at the top of the file:

```typescript
import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { requirePerson, getCurrentPerson } from "./helpers/auth";
import { api, internal } from "./_generated/api";
```

- [ ] **Step 4: Verify all files compile**

Run: `cd /Users/apoorva1509/conductor/workspaces/career-ops-v1/seville && npx convex dev --once 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add convex/outreachMessages.ts convex/outreachContacts.ts convex/outreachCompanies.ts
git commit -m "feat: auto-stop follow-ups on reply/company close, mark acted on outbound"
```

---

### Task 5: Types and Utils for Follow-Up UI

**Files:**
- Modify: `web/app/(app)/outreach-tracker/types.ts`
- Modify: `web/app/(app)/outreach-tracker/utils.ts`
- Modify: `web/hooks/use-outreach-tracker.ts`

- [ ] **Step 1: Add follow-up types**

Add to the end of `web/app/(app)/outreach-tracker/types.ts`:

```typescript
export type FollowUpStoppedReason = "manual" | "replied" | "closed";

export type ReminderStatus = "pending" | "notified" | "acted" | "dismissed";

export interface FollowUpReminder {
  _id: Id<"followUpReminders">;
  contactId: Id<"outreachContacts">;
  companyId: Id<"outreachCompanies">;
  channel: "linkedin_dm" | "linkedin_connection" | "email";
  dueAt: number;
  status: ReminderStatus;
  lastOutboundMessageId?: Id<"outreachMessages">;
  updatedAt: number;
}

export const STOPPED_REASON_LABELS: Record<FollowUpStoppedReason, string> = {
  manual: "Stopped manually",
  replied: "Contact replied",
  closed: "Company closed",
};
```

- [ ] **Step 2: Add `isOverdue` helper to utils**

Add to the end of `web/app/(app)/outreach-tracker/utils.ts`:

```typescript
import type { FollowUpReminder } from "./types";

export function isOverdue(reminder: FollowUpReminder): boolean {
  return (
    (reminder.status === "pending" || reminder.status === "notified") &&
    reminder.dueAt <= Date.now()
  );
}

export function daysOverdue(reminder: FollowUpReminder): number {
  return Math.max(0, Math.floor((Date.now() - reminder.dueAt) / (1000 * 60 * 60 * 24)));
}
```

Note: the existing import of `OutreachStep` at the top of `utils.ts` should be updated to also import `FollowUpReminder`:

```typescript
import type { OutreachStep, FollowUpReminder } from "./types";
```

- [ ] **Step 3: Add `useFollowUpReminders` and `useOverdueCount` hooks**

Add to the end of `web/hooks/use-outreach-tracker.ts`:

```typescript
export function useFollowUpReminders() {
  return useQuery(api.followUpReminders.listPending, {});
}

export function useFollowUpRemindersByContact(
  contactId: Id<"outreachContacts"> | null
) {
  return useQuery(
    api.followUpReminders.listByContact,
    contactId ? { contactId } : "skip"
  );
}

export function useOverdueCount() {
  return useQuery(api.followUpReminders.countOverdue, {});
}
```

- [ ] **Step 4: Verify frontend compiles**

Run: `cd /Users/apoorva1509/conductor/workspaces/career-ops-v1/seville/web && npx next build 2>&1 | tail -20`

Expected: Build succeeds (or at least no type errors in the modified files).

- [ ] **Step 5: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/types.ts web/app/\(app\)/outreach-tracker/utils.ts web/hooks/use-outreach-tracker.ts
git commit -m "feat: add follow-up reminder types, utils, and hooks"
```

---

### Task 6: Follow-Up Badge Component

**Files:**
- Create: `web/app/(app)/outreach-tracker/follow-up-badge.tsx`

- [ ] **Step 1: Create the badge component**

```typescript
"use client";

import { Clock, AlertTriangle } from "lucide-react";
import type { FollowUpReminder } from "./types";
import { daysOverdue } from "./utils";

interface FollowUpBadgeProps {
  reminder: FollowUpReminder;
}

export function FollowUpBadge({ reminder }: FollowUpBadgeProps) {
  const days = daysOverdue(reminder);

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
      {days > 3 ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {days === 0 ? "Follow-up due today" : `${days}d overdue`}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/follow-up-badge.tsx
git commit -m "feat: add FollowUpBadge component"
```

---

### Task 7: Contact Card — Overdue Badge + Action Buttons

**Files:**
- Modify: `web/app/(app)/outreach-tracker/contact-card.tsx`

- [ ] **Step 1: Add follow-up imports and state**

At the top of `contact-card.tsx`, add these imports:

```typescript
import { useMutation, useAction, useQuery } from "convex/react";
import { useFollowUpRemindersByContact } from "@/hooks/use-outreach-tracker";
import { FollowUpBadge } from "./follow-up-badge";
import { isOverdue } from "./utils";
import { Bell, BellOff, Copy, FileText, Linkedin } from "lucide-react";
```

Replace the existing `useMutation` import from `convex/react` (line 4) since we're now importing more.

- [ ] **Step 2: Add reminder query and follow-up actions inside the component**

Inside `ContactCard`, after the existing hooks (around line 50), add:

```typescript
  const reminders = useFollowUpRemindersByContact(contact._id);
  const activeReminder = reminders?.find((r) => isOverdue(r));
  const dismissReminder = useMutation(api.followUpReminders.dismiss);
  const stopFollowUp = useMutation(api.outreachContacts.stopFollowUp);
```

- [ ] **Step 3: Add the overdue badge next to the contact name**

In the button that renders the contact name (around line 94-97), add the badge after the name/title:

Find this block:
```tsx
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{contact.name}</p>
            {contact.title && (
              <p className="text-xs text-zinc-500">{contact.title}</p>
            )}
          </div>
```

Replace with:
```tsx
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{contact.name}</p>
              {activeReminder && <FollowUpBadge reminder={activeReminder} />}
            </div>
            {contact.title && (
              <p className="text-xs text-zinc-500">{contact.title}</p>
            )}
          </div>
```

- [ ] **Step 4: Add follow-up action buttons**

After the AI Suggestion block (around line 197, after the closing `</div>` of the suggestion section), add:

```tsx
              {/* Follow-up Actions */}
              {activeReminder && !suggestion && (
                <div className="mb-3 rounded-md border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-900/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                      Follow-up due — {activeReminder.channel === "email" ? "Email" : "LinkedIn"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleSuggest}
                      disabled={suggesting}
                      className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300"
                    >
                      <Sparkles className="h-3 w-3" />
                      Generate Follow-up
                    </button>
                    {contact.linkedinUrl && activeReminder.channel !== "email" && (
                      <button
                        onClick={async () => {
                          if (suggestion) {
                            await navigator.clipboard.writeText(suggestion.message);
                          }
                          window.open(contact.linkedinUrl!, "_blank");
                        }}
                        className="flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300"
                      >
                        <Linkedin className="h-3 w-3" />
                        Open LinkedIn
                      </button>
                    )}
                    <button
                      onClick={() => dismissReminder({ id: activeReminder._id })}
                      className="flex items-center gap-1 rounded-md bg-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-400"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => stopFollowUp({ id: contact._id, reason: "manual" })}
                      className="flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
                    >
                      <BellOff className="h-3 w-3" />
                      Stop Follow-ups
                    </button>
                  </div>
                </div>
              )}
```

- [ ] **Step 5: Show follow-up stopped indicator**

After the follow-up actions block, add a small indicator when follow-ups are stopped:

```tsx
              {contact.followUpEnabled === false && contact.followUpStoppedReason && (
                <div className="mb-3 flex items-center gap-1.5 text-xs text-zinc-400">
                  <BellOff className="h-3 w-3" />
                  Follow-ups stopped: {contact.followUpStoppedReason === "replied" ? "Contact replied" : contact.followUpStoppedReason === "closed" ? "Company closed" : "Stopped manually"}
                </div>
              )}
```

- [ ] **Step 6: Verify it compiles**

Run: `cd /Users/apoorva1509/conductor/workspaces/career-ops-v1/seville/web && npx tsc --noEmit 2>&1 | head -20`

Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/contact-card.tsx
git commit -m "feat: add follow-up badge and action buttons to contact card"
```

---

### Task 8: Outreach Tracker Page — Overdue Count Badge

**Files:**
- Modify: `web/app/(app)/outreach-tracker/page.tsx:1-35`

- [ ] **Step 1: Add overdue count to page header**

Add the import at the top of `page.tsx`:

```typescript
import { useOverdueCount } from "@/hooks/use-outreach-tracker";
```

Inside the component, after `const [tab, setTab] = useState<CompanyStatusFilter>("all");`, add:

```typescript
  const overdueCount = useOverdueCount();
```

Update the `<h1>` tag (around line 34) to include the overdue badge:

Replace:
```tsx
        <h1 className="text-2xl font-semibold">
          Outreach Tracker ({companies.length})
        </h1>
```

With:
```tsx
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            Outreach Tracker ({companies.length})
          </h1>
          {overdueCount !== undefined && overdueCount > 0 && (
            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
              {overdueCount} follow-up{overdueCount !== 1 ? "s" : ""} due
            </span>
          )}
        </div>
```

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/page.tsx
git commit -m "feat: show overdue follow-up count badge in tracker header"
```

---

### Task 9: Browser Push Notifications Hook

**Files:**
- Create: `web/hooks/use-follow-up-notifications.ts`

- [ ] **Step 1: Create the notification hook**

```typescript
"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useFollowUpReminders } from "./use-outreach-tracker";
import type { Id } from "@/convex/_generated/dataModel";

export function useFollowUpNotifications() {
  const reminders = useFollowUpReminders();
  const markNotified = useMutation(api.followUpReminders.markNotified);
  const notifiedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!reminders || reminders.length === 0) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    // Request permission on first load
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    if (Notification.permission !== "granted") return;

    // Fire notifications for pending reminders we haven't notified yet
    for (const reminder of reminders) {
      if (reminder.status !== "pending") continue;
      if (notifiedIds.current.has(reminder._id)) continue;

      notifiedIds.current.add(reminder._id);

      const notification = new Notification("Follow-up due", {
        body: `Time to follow up (${reminder.channel === "email" ? "Email" : "LinkedIn"})`,
        icon: "/icon.png",
        tag: reminder._id, // prevents duplicate OS notifications
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      markNotified({ id: reminder._id as Id<"followUpReminders"> });
    }
  }, [reminders, markNotified]);

  return {
    overdueCount: reminders?.filter(
      (r) => r.status === "pending" || r.status === "notified"
    ).length ?? 0,
  };
}
```

- [ ] **Step 2: Use the hook in the outreach tracker page**

In `web/app/(app)/outreach-tracker/page.tsx`, add the import and call:

```typescript
import { useFollowUpNotifications } from "@/hooks/use-follow-up-notifications";
```

Inside the component, after the `overdueCount` line, add:

```typescript
  useFollowUpNotifications();
```

This fires browser notifications whenever the outreach tracker page is open.

- [ ] **Step 3: Commit**

```bash
git add web/hooks/use-follow-up-notifications.ts web/app/\(app\)/outreach-tracker/page.tsx
git commit -m "feat: add browser push notifications for overdue follow-ups"
```

---

### Task 10: Gmail Sync Runner

**Files:**
- Create: `runner/gmail-sync/index.ts`
- Create: `runner/gmail-sync/convex-client.ts`

- [ ] **Step 1: Create the Convex client for Gmail runner**

Create `runner/gmail-sync/convex-client.ts`:

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const CONVEX_URL = process.env.CONVEX_URL ?? "";

let client: ConvexHttpClient | null = null;

function getClient(): ConvexHttpClient {
  if (!client) {
    if (!CONVEX_URL) throw new Error("CONVEX_URL not set");
    client = new ConvexHttpClient(CONVEX_URL);
  }
  return client;
}

export async function listAllContacts(): Promise<
  Array<{ _id: string; companyId: string; email?: string; linkedinUrl?: string; name: string }>
> {
  const c = getClient();
  // Uses the internal listAll query (no auth required for runner)
  const contacts = await c.query(api.outreachContacts.listAll, {});
  return contacts;
}

export async function listMessagesByContact(contactId: string) {
  const c = getClient();
  return await c.query(api.outreachMessages.listByContact, {
    contactId: contactId as any,
  });
}

export async function createMessage(args: {
  contactId: string;
  companyId: string;
  channel: "email";
  body: string;
  sentAt: number;
  direction: "outbound" | "inbound";
  gmailMessageId: string;
  gmailThreadId?: string;
}) {
  const c = getClient();
  await c.mutation(api.outreachMessages.create, {
    contactId: args.contactId as any,
    companyId: args.companyId as any,
    channel: args.channel,
    body: args.body,
    sentAt: args.sentAt,
    direction: args.direction,
    gmailMessageId: args.gmailMessageId,
    gmailThreadId: args.gmailThreadId,
  });
}

export async function checkGmailMessageExists(gmailMessageId: string): Promise<boolean> {
  const c = getClient();
  // Use a query to check — we'll need to add this to the backend
  const result = await c.query(api.outreachMessages.getByGmailMessageId, {
    gmailMessageId,
  });
  return result !== null;
}
```

- [ ] **Step 2: Add `listAll` query to outreachContacts.ts (for runner, no auth)**

Add to `convex/outreachContacts.ts`:

```typescript
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("outreachContacts").collect();
  },
});
```

- [ ] **Step 3: Add `getByGmailMessageId` query to outreachMessages.ts**

Add to `convex/outreachMessages.ts`:

```typescript
export const getByGmailMessageId = query({
  args: { gmailMessageId: v.string() },
  handler: async (ctx, { gmailMessageId }) => {
    return await ctx.db
      .query("outreachMessages")
      .withIndex("by_gmail_message_id", (q) => q.eq("gmailMessageId", gmailMessageId))
      .first();
  },
});
```

- [ ] **Step 4: Create the Gmail sync runner**

Create `runner/gmail-sync/index.ts`:

```typescript
/**
 * Gmail Sync Runner
 *
 * This script is designed to be run via Claude Code with Gmail MCP tools available.
 * It syncs sent emails and detects replies from outreach contacts.
 *
 * Usage:
 *   - Run manually: `npx tsx runner/gmail-sync/index.ts`
 *   - Or via Claude Code which has Gmail MCP access
 *
 * Environment variables:
 *   - CONVEX_URL: Convex deployment URL
 *
 * Note: Gmail MCP operations (reading emails, creating drafts) must be performed
 * by Claude Code. This script handles the Convex side of the sync.
 * The workflow is:
 *   1. Claude Code reads Gmail via MCP → gets email data
 *   2. This script matches emails to contacts → creates outreachMessages
 *   3. Claude Code creates drafts via MCP when requested
 */

import {
  listAllContacts,
  createMessage,
  checkGmailMessageExists,
} from "./convex-client.js";

interface GmailEmail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: number; // timestamp
}

/**
 * Sync a batch of emails from Gmail to outreachMessages.
 * Called by Claude Code after fetching emails via Gmail MCP.
 */
export async function syncEmails(emails: GmailEmail[], direction: "outbound" | "inbound") {
  const contacts = await listAllContacts();
  const contactsByEmail = new Map<string, (typeof contacts)[0]>();
  for (const contact of contacts) {
    if (contact.email) {
      contactsByEmail.set(contact.email.toLowerCase(), contact);
    }
  }

  let synced = 0;
  let skipped = 0;

  for (const email of emails) {
    // Match email to a contact
    const matchEmail = direction === "outbound" ? email.to : email.from;
    const normalizedEmail = matchEmail.toLowerCase().trim();
    // Extract email from "Name <email@example.com>" format
    const emailMatch = normalizedEmail.match(/<([^>]+)>/) ?? [null, normalizedEmail];
    const cleanEmail = emailMatch[1] ?? normalizedEmail;

    const contact = contactsByEmail.get(cleanEmail);
    if (!contact) {
      skipped++;
      continue;
    }

    // Check if already synced
    const exists = await checkGmailMessageExists(email.id);
    if (exists) {
      skipped++;
      continue;
    }

    // Create outreach message
    await createMessage({
      contactId: contact._id,
      companyId: contact.companyId,
      channel: "email",
      body: email.body,
      sentAt: email.date,
      direction,
      gmailMessageId: email.id,
      gmailThreadId: email.threadId,
    });
    synced++;
  }

  console.log(`Sync complete: ${synced} emails synced, ${skipped} skipped`);
  return { synced, skipped };
}

/**
 * Get contact email addresses for Gmail search queries.
 * Claude Code can use this to construct Gmail MCP queries.
 */
export async function getContactEmails(): Promise<string[]> {
  const contacts = await listAllContacts();
  return contacts
    .filter((c) => c.email)
    .map((c) => c.email!);
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Gmail sync runner ready.");
  console.log("This script provides sync functions for Claude Code to call.");
  console.log("Use getContactEmails() to get the list of contact emails to search for.");
  getContactEmails().then((emails) => {
    console.log(`Tracking ${emails.length} contact emails:`);
    for (const email of emails) {
      console.log(`  - ${email}`);
    }
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add runner/gmail-sync/index.ts runner/gmail-sync/convex-client.ts convex/outreachMessages.ts convex/outreachContacts.ts
git commit -m "feat: add Gmail sync runner for email import and reply detection"
```

---

### Task 11: Chrome Extension

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/content.js`

- [ ] **Step 1: Create the extension manifest**

Create `extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Career Ops - LinkedIn Paste",
  "version": "1.0.0",
  "description": "Pastes follow-up messages from Career Ops into LinkedIn's message composer",
  "permissions": ["clipboardRead"],
  "content_scripts": [
    {
      "matches": ["https://www.linkedin.com/messaging/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "icons": {}
}
```

- [ ] **Step 2: Create the content script**

Create `extension/content.js`:

```javascript
// Career Ops - LinkedIn Paste Extension
// Injects a floating "Paste Follow-up" button on LinkedIn messaging pages.
// The Career Ops web app copies the follow-up message to clipboard before
// opening LinkedIn, so this button just reads clipboard and pastes.

const BUTTON_ID = "career-ops-paste-btn";

function findComposer() {
  return (
    document.querySelector('div.msg-form__contenteditable[contenteditable="true"]') ||
    document.querySelector('div[role="textbox"][contenteditable="true"]')
  );
}

function injectPasteButton() {
  if (document.getElementById(BUTTON_ID)) return;

  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.textContent = "Paste Follow-up";
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "99999",
    padding: "10px 20px",
    background: "#7c3aed",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(124, 58, 237, 0.4)",
    transition: "all 0.2s ease",
  });

  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#6d28d9";
    btn.style.transform = "translateY(-1px)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "#7c3aed";
    btn.style.transform = "translateY(0)";
  });

  btn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.trim().length === 0) {
        btn.textContent = "Clipboard empty";
        btn.style.background = "#ef4444";
        setTimeout(() => btn.remove(), 2000);
        return;
      }

      const composer = findComposer();
      if (!composer) {
        btn.textContent = "No composer found — open a conversation first";
        btn.style.background = "#ef4444";
        setTimeout(() => {
          btn.textContent = "Paste Follow-up";
          btn.style.background = "#7c3aed";
        }, 3000);
        return;
      }

      composer.focus();
      composer.innerHTML = "<p>" + text.replace(/\n/g, "</p><p>") + "</p>";
      composer.dispatchEvent(new Event("input", { bubbles: true }));

      btn.textContent = "Pasted! Review and send.";
      btn.style.background = "#22c55e";
      setTimeout(() => btn.remove(), 3000);
    } catch (err) {
      btn.textContent = "Clipboard access denied";
      btn.style.background = "#ef4444";
      setTimeout(() => btn.remove(), 3000);
    }
  });

  document.body.appendChild(btn);
}

// Wait for LinkedIn's messaging UI to settle, then inject
setTimeout(injectPasteButton, 2500);

// Re-inject if navigating within LinkedIn (SPA)
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    if (location.href.includes("/messaging/")) {
      setTimeout(injectPasteButton, 2500);
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });
```

- [ ] **Step 3: Commit**

```bash
git add extension/manifest.json extension/content.js
git commit -m "feat: add minimal Chrome extension for LinkedIn message paste"
```

---

### Task 12: Integration — "Send via LinkedIn" Button in Contact Card

**Files:**
- Modify: `web/app/(app)/outreach-tracker/contact-card.tsx`

- [ ] **Step 1: Update the "Open LinkedIn" button to copy-then-open flow**

In the follow-up action buttons section added in Task 7, the LinkedIn button already copies + opens. Enhance it to also show feedback:

Find the LinkedIn button in the follow-up actions block and replace with:

```tsx
                    {contact.linkedinUrl && activeReminder.channel !== "email" && (
                      <button
                        onClick={async () => {
                          const msg = suggestion?.message;
                          if (msg) {
                            await navigator.clipboard.writeText(msg);
                          }
                          // Open LinkedIn messaging — the Chrome extension will show "Paste Follow-up" button
                          const linkedinUrl = contact.linkedinUrl!;
                          // Try to open messaging directly if it's a profile URL
                          const messagingUrl = linkedinUrl.includes("/messaging/")
                            ? linkedinUrl
                            : linkedinUrl.replace(/\/?$/, "") + "/overlay/messaging/";
                          window.open(messagingUrl, "_blank");
                        }}
                        className="flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300"
                      >
                        <Linkedin className="h-3 w-3" />
                        {suggestion ? "Copy & Open LinkedIn" : "Open LinkedIn"}
                      </button>
                    )}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/contact-card.tsx
git commit -m "feat: copy-then-open LinkedIn flow for follow-up paste"
```

---

### Task 13: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Push schema and verify Convex deployment**

Run: `cd /Users/apoorva1509/conductor/workspaces/career-ops-v1/seville && npx convex dev --once 2>&1 | tail -20`

Expected: All functions registered, cron scheduled, no errors.

- [ ] **Step 2: Verify web app compiles**

Run: `cd /Users/apoorva1509/conductor/workspaces/career-ops-v1/seville/web && npx tsc --noEmit 2>&1 | head -30`

Expected: No type errors.

- [ ] **Step 3: Manual smoke test checklist**

1. Open the outreach tracker page
2. Verify the overdue count badge appears in the header (if any contacts are overdue)
3. Expand a contact card — check for follow-up badge if overdue
4. Click "Generate Follow-up" — verify suggestion appears
5. Click "Copy & Open LinkedIn" — verify clipboard has the message and LinkedIn opens
6. Click "Dismiss" — verify reminder disappears
7. Click "Stop Follow-ups" — verify indicator shows "Stopped manually"
8. Log an inbound message for a contact — verify follow-ups auto-stop with "Contact replied"
9. Change a company status to "closed" — verify all contacts show "Company closed"
10. Check browser notification permission prompt appears on first visit
11. Load the Chrome extension in `chrome://extensions` (developer mode, "Load unpacked" → select `extension/` directory)
12. Navigate to a LinkedIn messaging conversation — verify "Paste Follow-up" button appears

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: follow-up automation — complete implementation"
```

---

## Summary

| Task | What it does | Files |
|---|---|---|
| 1 | Schema changes | `convex/schema.ts` |
| 2 | Reminder CRUD | `convex/followUpReminders.ts` |
| 3 | Cron job (every 6h) | `convex/followUpCron.ts`, `convex/crons.ts` |
| 4 | Auto-stop side effects | `convex/outreachMessages.ts`, `convex/outreachContacts.ts`, `convex/outreachCompanies.ts` |
| 5 | Types + utils + hooks | `types.ts`, `utils.ts`, `use-outreach-tracker.ts` |
| 6 | Follow-up badge component | `follow-up-badge.tsx` |
| 7 | Contact card UI | `contact-card.tsx` |
| 8 | Page header badge | `page.tsx` |
| 9 | Browser notifications | `use-follow-up-notifications.ts` |
| 10 | Gmail sync runner | `runner/gmail-sync/` |
| 11 | Chrome extension | `extension/` |
| 12 | LinkedIn copy+open flow | `contact-card.tsx` |
| 13 | Final verification | Manual testing |
