# Follow-up Automation: LinkedIn + Email + Reminders

**Date:** 2026-04-11
**Status:** Draft
**Approach:** Backend-First (Approach B)

## Problem

The outreach tracker requires manual logging of every message sent/received and manual checking of who needs a follow-up. User is actively job searching and needs aggressive 2-day follow-up cadence across LinkedIn (DMs + connection requests) and email, with auto-stop on reply or manual stop.

## Requirements Summary

| Requirement | Detail |
|---|---|
| Channels | LinkedIn DMs, LinkedIn connection requests, Email |
| Follow-up interval | 2 days since last outbound message, all channels |
| Stop conditions | Inbound reply detected, manual stop, company status changed to "closed" |
| LinkedIn send | Minimal Chrome extension — pastes AI-generated message into LinkedIn composer, user clicks send |
| Email send | Gmail MCP creates a draft in Gmail, user reviews and sends |
| Email sync | Gmail MCP reads sent emails, matches to contacts, logs in outreachMessages |
| Reminders | Badge in web UI + browser push notifications (macOS native via Notification API) |
| Message generation | Reuse existing `outreachSuggest.suggestFollowUp` action |

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Convex Backend                     │
│                                                      │
│  outreachContacts   ← new: followUpEnabled, stopReason│
│  outreachMessages   ← new: gmailMessageId, gmailThreadId│
│  followUpReminders  ← NEW TABLE                      │
│                                                      │
│  Cron: checkFollowUps (runs every 6 hours)           │
│    → scans active contacts                           │
│    → creates/updates followUpReminders               │
│    → auto-stops on inbound reply detection            │
│                                                      │
│  Mutation: dismissReminder, stopFollowUp              │
│  Query: listOverdueContacts, listPendingReminders     │
├─────────────────────────────────────────────────────┤
│                   Web App (Next.js)                   │
│                                                      │
│  Outreach Tracker page                                │
│    → "Overdue" badge on contacts needing follow-up   │
│    → "Follow Up" button generates message + action    │
│    → "Send via LinkedIn" → sends to Chrome extension │
│    → "Create Gmail Draft" → calls Gmail runner        │
│    → "Stop Follow-ups" per contact                    │
│    → Browser Notification API for push alerts         │
│    → Notification permission request on first visit   │
├─────────────────────────────────────────────────────┤
│              Gmail Sync Runner (Node.js)              │
│                                                      │
│  runner/gmail-sync/index.ts                           │
│    → Uses Gmail MCP to read sent emails              │
│    → Matches sender/recipient to outreachContacts     │
│    → Logs new messages to outreachMessages            │
│    → Detects inbound replies → marks contact replied  │
│    → Creates Gmail drafts for approved follow-ups     │
│    → Runs on schedule or manual trigger               │
├─────────────────────────────────────────────────────┤
│           Chrome Extension (Minimal)                  │
│                                                      │
│  extension/                                           │
│    manifest.json (Manifest V3)                       │
│    content.js (~50 lines)                            │
│      → Injects "Paste Follow-up" button on LinkedIn  │
│      → On click: reads clipboard, pastes into composer│
│      → Does NOT click send                           │
└─────────────────────────────────────────────────────┘
```

## Data Model Changes

### Modified: `outreachContacts`

Add two fields:

```typescript
followUpEnabled: v.optional(v.boolean()),   // default true (treat undefined as true)
followUpStoppedReason: v.optional(
  v.union(
    v.literal("manual"),      // user clicked "stop follow-ups"
    v.literal("replied"),     // inbound message detected
    v.literal("closed")       // company status changed to closed
  )
),
```

### Modified: `outreachMessages`

Add two optional fields for Gmail dedup:

```typescript
gmailMessageId: v.optional(v.string()),   // Gmail message ID
gmailThreadId: v.optional(v.string()),    // Gmail thread ID for reply detection
```

Add index for dedup:

```typescript
.index("by_gmail_message_id", ["gmailMessageId"])
```

### New Table: `followUpReminders`

```typescript
followUpReminders: defineTable({
  contactId: v.id("outreachContacts"),
  companyId: v.id("outreachCompanies"),
  channel: v.union(
    v.literal("linkedin_dm"),
    v.literal("linkedin_connection"),
    v.literal("email")
  ),
  dueAt: v.number(),              // timestamp: lastOutboundMessage.sentAt + 2 days
  status: v.union(
    v.literal("pending"),          // due but not yet seen
    v.literal("notified"),         // browser notification sent
    v.literal("acted"),            // user sent follow-up or logged message
    v.literal("dismissed")         // user dismissed this reminder
  ),
  lastOutboundMessageId: v.optional(v.id("outreachMessages")),  // which message triggered this
  updatedAt: v.number(),
})
  .index("by_contact", ["contactId"])
  .index("by_status", ["status"])
  .index("by_company", ["companyId"])
  .index("by_due", ["dueAt"])
```

## Component 1: Convex Cron — Follow-up Checker

**File:** `convex/followUpCron.ts`

**Runs every 6 hours** via Convex cron scheduler.

**Logic:**

1. Query all `outreachContacts` where `followUpEnabled !== false`
2. For each contact, get their parent `outreachCompany` — skip if company status is `"closed"` or `"paused"`
3. Get latest `outreachMessage` for this contact
4. If latest message is `direction: "inbound"` → auto-stop: set `followUpEnabled: false`, `followUpStoppedReason: "replied"`, mark any pending reminder as `"dismissed"`
5. If latest message is `direction: "outbound"` and `sentAt + 2 days < now` → check if a `"pending"` or `"notified"` reminder already exists for this contact
   - If no active reminder exists → create one with `dueAt = lastMessage.sentAt + 2 days`, `status: "pending"`, `channel` matching the last outbound channel
   - If reminder already exists → no-op
6. If no messages exist for this contact → skip (no outreach started yet)

**Cron registration** in `convex/crons.ts`:

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("check follow-ups", { hours: 6 }, internal.followUpCron.checkAll);
export default crons;
```

## Component 2: Web UI — Overdue Badges + Notifications

### Badge on Contact Card

**File:** `web/app/(app)/outreach-tracker/contact-card.tsx`

Changes:
- Query `followUpReminders` for this contact (pending or notified status)
- If reminder exists and is overdue → show orange "Follow-up due" badge next to contact name
- Show days overdue: "2d overdue"

### Follow-up Action Buttons

When a reminder is active, show action row below the badge:

- **"Generate Follow-up"** — calls existing `suggestFollowUp`, shows draft
- **"Send via LinkedIn"** — posts message to Chrome extension via `window.postMessage` with `{ type: "CAREER_OPS_LINKEDIN_PASTE", message: "...", linkedinUrl: contact.linkedinUrl }`
- **"Create Gmail Draft"** — calls Gmail sync runner (via Convex HTTP action that triggers the runner) to create a draft
- **"Dismiss"** — marks reminder as dismissed (will re-trigger after next outbound)
- **"Stop Follow-ups"** — sets `followUpEnabled: false` with reason `"manual"`

### Browser Notifications

**File:** `web/app/(app)/outreach-tracker/use-follow-up-notifications.ts` (new hook)

Logic:
1. On page mount, request `Notification.permission` if not yet granted
2. Subscribe to `followUpReminders` query (all pending for current user)
3. When new pending reminders appear that haven't been notified:
   - Fire `new Notification("Follow-up due", { body: "Message ${contact.name} at ${company.name} — ${days}d since last contact", icon: "/icon.png" })`
   - Update reminder status to `"notified"` via mutation
4. Clicking the notification focuses the web app tab

### Outreach Tracker Page Header

**File:** `web/app/(app)/outreach-tracker/page.tsx`

Add a count badge next to "Outreach Tracker" title: `"3 follow-ups due"` in orange.

## Component 3: Gmail Sync Runner

**File:** `runner/gmail-sync/index.ts`

A Node.js script that runs manually or on a schedule. Uses Gmail MCP tools available in Claude Code environment.

### Sync Sent Emails

1. Call Gmail MCP to list sent emails from the last 7 days
2. For each email, extract recipient email address
3. Match recipient to `outreachContacts` by `email` field
4. If match found and `gmailMessageId` not already in `outreachMessages` → create new message:
   ```
   channel: "email"
   direction: "outbound"
   body: email body (plain text)
   sentAt: email timestamp
   gmailMessageId: email.id
   gmailThreadId: email.threadId
   ```

### Detect Inbound Replies

1. Call Gmail MCP to list inbox emails from the last 7 days
2. For each email, check if sender email matches any `outreachContact.email`
3. If match found and not already logged → create inbound message + auto-stop follow-ups for that contact

### Create Gmail Draft

Exposed as a Convex action callable from the web UI:

1. Web UI calls `createGmailDraft` action with contactId + message body + subject
2. Action calls Gmail MCP to create a draft with:
   - To: contact.email
   - Subject: provided subject (or "Following up — {company.roleAppliedFor}")
   - Body: the AI-generated message
3. Draft appears in user's Gmail Drafts folder
4. User reviews in Gmail and clicks Send

**Note:** Since Gmail MCP is only available in the Claude Code environment (not in Convex server-side), the draft creation and email sync will be implemented as a runner script (`runner/gmail-sync/`) that communicates with Convex via the HTTP client, similar to the existing `runner/job-hunter/convex-client.ts` pattern.

## Component 4: Chrome Extension (Minimal)

**Directory:** `extension/`

### Files

**`manifest.json`** (Manifest V3):
```json
{
  "manifest_version": 3,
  "name": "Career Ops - LinkedIn Paste",
  "version": "1.0",
  "description": "Pastes follow-up messages into LinkedIn composer",
  "permissions": ["clipboardRead"],
  "content_scripts": [{
    "matches": ["https://www.linkedin.com/messaging/*"],
    "js": ["content.js"]
  }]
}
```

**`content.js`** (~50 lines):

The extension injects a floating "Paste Follow-up" button on LinkedIn messaging pages. When clicked, it reads the clipboard (which the web app already copied to) and pastes into the composer. This avoids all cross-origin messaging complexity.

```javascript
const BUTTON_ID = "career-ops-paste-btn";

function injectPasteButton() {
  if (document.getElementById(BUTTON_ID)) return;
  
  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.textContent = "Paste Follow-up";
  btn.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:99999;padding:8px 16px;background:#7c3aed;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.2);";
  
  btn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      const composer = document.querySelector(
        'div.msg-form__contenteditable[contenteditable="true"]'
      ) || document.querySelector('div[role="textbox"][contenteditable="true"]');
      
      if (composer) {
        composer.focus();
        composer.innerHTML = `<p>${text}</p>`;
        composer.dispatchEvent(new Event("input", { bubbles: true }));
        btn.textContent = "Pasted!";
        setTimeout(() => btn.remove(), 2000);
      } else {
        btn.textContent = "No composer found";
      }
    } catch {
      btn.textContent = "Clipboard access denied";
    }
  });
  
  document.body.appendChild(btn);
}

// Inject after page settles
setTimeout(injectPasteButton, 2000);
```

### Web App → Extension Flow

1. User clicks "Send via LinkedIn" in web app
2. Web app copies the follow-up message to clipboard (`navigator.clipboard.writeText`)
3. Web app opens LinkedIn messaging URL for the contact in a new tab
4. Extension's content script injects "Paste Follow-up" button on the LinkedIn page
5. User clicks "Paste Follow-up" → message is pasted into composer
6. User reviews and clicks LinkedIn's Send button

## Component 5: Convex Functions (New/Modified)

### New: `convex/followUpReminders.ts`

**Queries:**
- `listPending` — all reminders with status "pending" or "notified" for current user's companies
- `listByContact` — reminders for a specific contact
- `countOverdue` — count of pending reminders (for header badge)

**Mutations:**
- `dismiss` — set status to "dismissed"
- `markNotified` — set status to "notified" (called after browser notification fired)
- `markActed` — set status to "acted" (called after user sends follow-up or logs message)

### New: `convex/followUpCron.ts`

**Internal mutation:** `checkAll` — the cron logic described in Component 1

### Modified: `convex/outreachMessages.ts`

- `create` mutation: after creating a new outbound message, mark any pending reminder for that contact as "acted"
- `create` mutation: after creating a new inbound message, auto-stop follow-ups for that contact

### Modified: `convex/outreachContacts.ts`

- `update` mutation: accept `followUpEnabled` and `followUpStoppedReason` fields
- New mutation: `stopFollowUp` — sets `followUpEnabled: false` with reason, dismisses pending reminders

### Modified: `convex/outreachCompanies.ts`

- `update` mutation: when status changes to `"closed"`, auto-stop follow-ups for all contacts at that company

## Component 6: New React Hook

### `web/hooks/use-follow-up-notifications.ts`

```typescript
// Subscribes to pending reminders
// Fires browser notifications for new ones
// Returns: { overdueCount, reminders, dismissReminder, stopFollowUp }
```

Used in:
- `outreach-tracker/page.tsx` — for header badge count
- `outreach-tracker/contact-card.tsx` — for per-contact badge + actions

## File Inventory

### New Files

| File | Purpose |
|---|---|
| `convex/followUpReminders.ts` | CRUD for reminder records |
| `convex/followUpCron.ts` | Cron job logic — scan contacts, create/dismiss reminders |
| `convex/crons.ts` | Convex cron registration |
| `web/hooks/use-follow-up-notifications.ts` | Browser notification hook + overdue state |
| `runner/gmail-sync/index.ts` | Gmail MCP sync script — sent emails, replies, draft creation |
| `runner/gmail-sync/convex-client.ts` | Convex HTTP client for Gmail runner (or reuse existing) |
| `extension/manifest.json` | Chrome extension manifest |
| `extension/content.js` | LinkedIn paste content script |

### Modified Files

| File | Change |
|---|---|
| `convex/schema.ts` | Add fields to outreachContacts + outreachMessages, add followUpReminders table |
| `convex/outreachMessages.ts` | Auto-mark reminders on new messages, add gmailMessageId fields |
| `convex/outreachContacts.ts` | Add stopFollowUp mutation, accept new fields |
| `convex/outreachCompanies.ts` | Auto-stop follow-ups on company close |
| `web/app/(app)/outreach-tracker/contact-card.tsx` | Overdue badge, follow-up action buttons, LinkedIn paste flow |
| `web/app/(app)/outreach-tracker/page.tsx` | Header overdue count badge |
| `web/app/(app)/outreach-tracker/types.ts` | New types for reminders |
| `web/app/(app)/outreach-tracker/utils.ts` | Helper for overdue calculation |

## Implementation Order

1. **Schema + data model** — Add new table and fields
2. **Cron job** — Follow-up checker logic
3. **Reminder queries/mutations** — CRUD for reminders
4. **Contact card UI** — Badges + action buttons
5. **Browser notifications** — Hook + permission flow
6. **Gmail sync runner** — Sent email import + reply detection + draft creation
7. **Chrome extension** — Minimal LinkedIn paste helper
8. **Integration testing** — End-to-end flow verification

## Edge Cases

- **Contact has no email and no LinkedIn URL:** Skip — no channel to follow up on
- **Multiple channels used with same contact:** Create reminder for the channel of the most recent outbound message
- **User logs an inbound message manually:** Same auto-stop logic triggers (the `create` mutation handles it regardless of source)
- **Company paused (not closed):** Do NOT auto-stop, but skip creating new reminders while paused. Resume when company becomes active again.
- **Gmail sync finds email to unknown contact:** Ignore — only match against existing outreachContacts
- **Extension DOM selector breaks:** The "Paste Follow-up" button simply won't find the composer. Show "No composer found" message. Fix is a 1-line selector update.
- **Notification permission denied:** Fall back to UI badges only. No nagging — show a subtle banner once suggesting to enable notifications.

## Out of Scope

- Reading LinkedIn message history automatically (too risky for account ban)
- Auto-sending messages on any platform (user always clicks send)
- WhatsApp integration (deprioritized per requirements)
- Multi-user / team features (this is a personal tool)
- LinkedIn OAuth or official API (not available to individuals)
