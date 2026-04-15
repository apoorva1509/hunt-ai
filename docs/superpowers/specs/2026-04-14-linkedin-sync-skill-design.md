# LinkedIn Sync Skill — Design Spec

## Overview

A Claude Code skill (`/linkedin-sync`) that uses `agent-browser` to scrape three LinkedIn pages and sync all data into the outreach CRM. Persists sync cursors in Convex + memory so subsequent runs only process new data.

## Pages Scraped

1. **Connections** (`/mynetwork/invite-connect/connections/`) — sorted "Recently added". Scroll until hitting the last synced connection name+date. Extract: name, headline, company, LinkedIn URL, connection date.

2. **Sent Invitations** (`/mynetwork/invitation-manager/sent/`) — pending connection requests. Extract: name, headline, LinkedIn URL, note text (if sent with note). Always scanned fully (small list).

3. **Messaging** (`/messaging/`) — DM conversations. Click each conversation newer than last sync, read thread, extract messages. Filter out LinkedIn quick-reply suggestions. Dedup against existing messages in DB.

## Sync State

### Convex Table: `linkedinSyncState`

```
userId: string
lastRunAt: number
lastConnectionName: string
lastConnectionDate: string
totalConnectionsSynced: number
lastInvitationName: string
totalInvitationsSynced: number
lastMessageContactName: string
lastMessageBody: string (first 100 chars)
lastMessageTimestamp: number
totalMessagesSynced: number
updatedAt: number
```

Single row per user, upserted on each sync run.

### Memory File: `reference_linkedin_sync.md`

Human-readable summary updated after each sync. Available across workspaces.

## Data Flow

### Phase 1: Connections

1. Open connections page, scroll `#workspace` container
2. Extract name, headline, "Connected on {date}", LinkedIn URL for each card
3. Stop scrolling when we hit `lastConnectionName` on `lastConnectionDate` (or reach connections older than last sync date)
4. For each new connection:
   - Parse company from headline (regex + manual override patterns)
   - Classify contact type from headline
   - Find or create outreach company (`addCompanyWithEnrichment` or create with Clearbit logo)
   - Create outreach contact under that company
   - Log via `linkedinLog:logConnection` with status "accepted"

### Phase 2: Sent Invitations

1. Open sent invitations page
2. Extract all pending invitations: name, headline, LinkedIn URL, note text
3. For each:
   - Find or create outreach company
   - Create outreach contact
   - Log via `linkedinLog:logConnection` with status "pending"
   - If note exists, log as `linkedin_connection` message via `outreachMessages:createFromSync`

### Phase 3: Messages

1. Open messaging page, scroll sidebar to load conversations
2. For each conversation with timestamp > last sync:
   - Click conversation, read thread via `.msg-s-message-list-content`
   - Parse messages: sender, timestamp, body (filter quick-reply suggestions)
   - Find matching outreach contact by name (fuzzy match)
   - If no contact found → create outreach company + contact
   - For each message newer than last sync timestamp:
     - Dedup: skip if same body + same direction + within 24h of existing message
     - Log via `outreachMessages:createFromSync`

### Phase 4: Update Cursors

1. Update `linkedinSyncState` in Convex with new cursor values
2. Update memory file with human-readable summary

## Company/Contact Creation

When a person is found who doesn't have an outreach company:

1. Extract company name from headline
2. Derive domain (e.g., "Stripe" → "stripe.com")
3. Create outreach company with:
   - `name`, `domain`, `logoUrl` (Clearbit), `isYcBacked: false`, `status: "active"`
4. Create outreach contact under it with:
   - `name`, `title` (from headline), `linkedinUrl`, `source: "linkedin"`
   - `tier`: tier1 for founders/execs, tier2 for recruiters, tier3 for peers

## Message Parsing Rules

- Date headers: TODAY, YESTERDAY, day names (resolve to actual dates based on current date)
- Message format: `"Name   HH:MM AM/PM"` followed by body lines
- Skip: "View X's profile", "sent the following message", "Download", "X KB", PDF filenames, "Scroll quick replies", "Reply to conversation with"
- Direction: contains "Apoorva" = outbound, else inbound

## Dedup Strategy

- **Connections**: Match by LinkedIn URL. If person already exists with status "accepted", skip.
- **Messages**: Match by contactId + body content + sentAt within 24h window.
- **Contacts**: Match by LinkedIn URL within same company.

## Skill File Structure

```
.claude/skills/linkedin-sync/
  SKILL.md          — Skill definition + instructions
```

The skill orchestrates agent-browser commands and Convex mutations directly. No separate Node.js script needed — the skill instructions tell Claude how to execute the sync step by step.

## Auth Handling

- Close browser, open with `--state ~/.agent-browser/linkedin-auth.json`
- If auth expired: fill email (apoorvaagarwal1509@gmail.com), fill password, click sign in via JS
- Save state after login
- Never prompt user for login

## Convex Mutations Used

| Operation | Mutation |
|-----------|----------|
| Log connection | `linkedinLog:logConnection` (internal) |
| Create outreach company | `outreachCompanies:create` (auth) or internal |
| Create outreach contact | `outreachContacts:createFromResearch` (internal) |
| Log message | `outreachMessages:createFromSync` (internal) |
| Update sync state | `linkedinSyncState:upsert` (internal) |
| Read sync state | `linkedinSyncState:get` (internal) |
