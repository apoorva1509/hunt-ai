---
name: linkedin-sync
description: Sync LinkedIn connections, sent invitations, and DM conversations into the outreach CRM. Tracks sync state so each run only processes new data.
user_invocable: true
---

# linkedin-sync — Full LinkedIn CRM Sync

Scrapes three LinkedIn pages via `agent-browser` and syncs everything into the outreach CRM:
1. New connections (accepted)
2. Sent invitations (pending, with notes)
3. DM conversations (new + updated threads)

## Prerequisites

Before running any agent-browser commands, load the skill:
```bash
agent-browser skills get agent-browser
```

## Auth

1. Close any existing browser: `agent-browser close`
2. Open with saved state: `agent-browser open "https://www.linkedin.com" --state ~/.agent-browser/linkedin-auth.json`
3. If redirected to login page (URL contains `/login` or `/uas/login`):
   - Load credentials from `~/.claude/credentials/linkedin.env` (source the file to get `LINKEDIN_EMAIL` and `LINKEDIN_PASSWORD`)
   - Fill email: `agent-browser fill @emailRef "$LINKEDIN_EMAIL"`
   - Fill password: `agent-browser fill @passRef "$LINKEDIN_PASSWORD"`
   - Click sign in via JS: `agent-browser eval "document.querySelectorAll('button').forEach(function(b) { if(b.textContent.trim() === 'Sign in') b.click() })"`
   - Wait 5 seconds, then save state: `agent-browser state save ~/.agent-browser/linkedin-auth.json`
4. **NEVER ask the user to log in.** Handle auth silently.

## Step 0 — Load Sync State

Read the last sync state to know where to resume:

```bash
npx convex run --no-push linkedinSyncState:get '{"userId":"CURRENT_USER_ID"}'
```

If no state exists, this is a first run — sync everything from the last 7 days.

Also read the memory file for context:
- `/Users/apoorva1509/.claude/projects/-Users-apoorva1509-conductor-repos-career-ops-v1/memory/reference_linkedin_sync.md`

**To get the userId**, use the helper function:
```bash
npx convex run --no-push linkedinSyncState:findUserId '{}'
```
This returns the clerkTokenIdentifier from the first person record.

---

## Step 1 — Sync Connections

**Page:** `https://www.linkedin.com/mynetwork/invite-connect/connections/`

### 1a. Navigate and scroll

```bash
agent-browser open "https://www.linkedin.com/mynetwork/invite-connect/connections/"
```

The connections list is inside `main#workspace`. Scroll it to load more:

```javascript
document.getElementById('workspace').scrollTop = document.getElementById('workspace').scrollHeight
```

Keep scrolling (with 3s pauses) until you see connections older than the `lastConnectionDate` from sync state, or if first run, until 7 days ago.

### 1b. Extract connections

Get the full text of the workspace element. Parse connections using this pattern:

```
{Name}
{Headline}
Connected on {Month Day, Year}
Message
```

For each connection:
1. Extract: `name`, `headline`, `connectedDate`
2. Extract LinkedIn profile URL from the `<a href="/in/...">` links on the page

### 1c. Stop condition

Stop when you encounter a connection with:
- Same name AND same date as `lastConnectionName` + `lastConnectionDate` from sync state
- OR a connection date older than last sync

### 1d. Process each connection — Visit profile for company

For each NEW connection (not yet synced):

**CRITICAL: Visit the LinkedIn profile to get the actual company and title.**

DO NOT extract company from the headline. Headlines are unreliable — they contain:
- Job titles mistaken as companies: "Engineering Leader", "Recruitment Specialist"
- Compound strings: "Founding Engineer Knowl", "Sr Recruiter EarnIn"
- Multiple companies: "CEO @Recrew AI & @Gloroots"
- Slogans: "Hiring the Best Minds in Tech"

**How to read the profile intro card:**

1. Navigate to the profile URL: `agent-browser open "https://www.linkedin.com/in/{slug}/"`
2. Wait 3 seconds for the page to load
3. Read the intro card text:

```javascript
var main = document.querySelector('main');
main ? main.innerText.substring(0, 800) : 'not found'
```

4. The intro card follows this structure:
```
{Name}
· 1st/2nd/3rd
{Headline}
{Location}
· Contact info
{Current Company}     ← THIS is the real company name
{School}
```

The company name appears as a standalone line after "Contact info" — it's the company from their current experience entry. This is the **source of truth** for the company.

5. If the profile shows no company (e.g., freelancer, between jobs), check their Activity section for hiring posts — recruiters often post "We are hiring at {Company}". Use that company.

6. **Last resort only**: If the profile can't be loaded at all, use "Unknown" / "unknown.com". NEVER guess from headlines.

**Extract the company's LinkedIn URL** (CRITICAL for dedup — see Rule #15):

The company name in the intro card is a clickable link to the company's LinkedIn page when the company has one. Pull the `href` so we can dedup the company globally regardless of name spelling ("Wardly AI" vs "WardlyAI"):

```javascript
// Find the first /company/ link inside the intro card area
var anchors = document.querySelectorAll('main a[href*="/company/"]');
var url = null;
for (var i = 0; i < anchors.length; i++) {
  var href = anchors[i].getAttribute('href');
  if (href && href.includes('/company/')) {
    url = href.startsWith('http') ? href : 'https://www.linkedin.com' + href;
    break;
  }
}
url ? url.split('?')[0] : null
```

Pass the result as `companyLinkedinUrl` to `ensureOutreachContact`. If the profile has no company link, omit the field — name + domain dedup will fall back to normalized matching.

**Derive domain from company name:**
- lowercase, remove spaces → `.com` (e.g., "Stripe" → "stripe.com")
- For known domains, use the correct one (e.g., "Fulfil.IO" → "fulfil.io", "Gloroots AI" → "gloroots.com")

**Rate limit**: Add 2-3 second pauses between profile visits to avoid LinkedIn throttling.

**Classify contact type from the profile title (NOT headline):**
| Pattern | Type | Tier |
|---------|------|------|
| recruit, talent acqui, HR, hiring, people & talent | recruiter | tier2 |
| hiring manager | hiring_manager | tier2 |
| co-founder, founder | founder | tier1 |
| CEO, CTO, COO, VP, Head of, Director | executive | tier1 |
| engineer, developer, SDE, SWE, data, analyst | peer | tier3 |
| everything else | other | tier3 |

**Create records:**

```bash
# Create outreach company + contact (deduplicates by LinkedIn URL globally).
# Company dedup priority: companyLinkedinUrl > companyDomain > normalized name.
# ALWAYS pass companyLinkedinUrl when the profile has a company link — it is
# the only field that reliably collapses "Wardly AI" / "WardlyAI" / "Wardly.AI".
npx convex run --no-push linkedinSync:ensureOutreachContact '{
  "userId": "...",
  "companyName": "...",
  "companyDomain": "...",
  "companyLinkedinUrl": "https://www.linkedin.com/company/...",
  "contactName": "...",
  "contactTitle": "...",
  "contactLinkedinUrl": "...",
  "contactHeadline": "...",
  "contactType": "...",
  "tier": "..."
}'

# Also log in the people/connectionRequests tables (deduplicates by personId+companyId)
npx convex run --no-push linkedinLog:logConnection '{
  "personName": "...",
  "personLinkedinUrl": "...",
  "companyDomain": "...",
  "companyName": "...",
  "contactTitle": "...",
  "contactType": "...",
  "connectionStatus": "accepted",
  "messageSent": false,
  "notes": "Connected on {date}. Synced via /linkedin-sync."
}'
```

### 1e. Track progress

After processing all connections, note the first (newest) connection's name and date for the cursor update.

---

## Step 2 — Sync Sent Invitations

**Page:** `https://www.linkedin.com/mynetwork/invitation-manager/sent/`

### 2a. Navigate

```bash
agent-browser open "https://www.linkedin.com/mynetwork/invitation-manager/sent/"
```

### 2b. Scroll and extract pending invitations

Scroll `main#workspace` to load invitations. **Only sync invitations within the time window** — stop scrolling when you see invitations older than the sync window (last sync timestamp, or 7 days for first run).

Each invitation shows:
- Name
- Headline
- LinkedIn profile URL (in `<a href="...linkedin.com/in/...">` tags)
- "Sent X ago" timestamp
- Note text (if sent with a note)

**Date filtering**: Parse the "Sent X ago" relative timestamps. Skip invitations sent before the sync window:
- "X hours ago", "yesterday", "2 days ago" — within range
- "1 week ago", "1 month ago", "3 months ago" — likely out of range, check against sync window

### 2c. Process each invitation — Visit profile for company

For each pending invitation within the sync window:

1. **Visit the person's LinkedIn profile** to get their actual current company and title (same technique as Step 1d — read the intro card, extract company from the line after "Contact info")
2. **Create outreach company + contact** using the profile-extracted company info via `linkedinSync:ensureOutreachContact` — pass `"connectionStatus": "pending"`
3. **Log connection request** with `connectionStatus: "pending"` via `linkedinLog:logConnection`
4. **If note exists**, log it as a message:

```bash
npx convex run --no-push outreachMessages:createFromSync '{
  "contactId": "...",
  "companyId": "...",
  "channel": "linkedin_connection",
  "body": "...(the note text)...",
  "sentAt": ...(epoch)...,
  "direction": "outbound"
}'
```

---

## Step 3 — Sync Messages

**Page:** `https://www.linkedin.com/messaging/`

### 3a. Navigate and load conversations

```bash
agent-browser open "https://www.linkedin.com/messaging/"
```

Scroll the conversation sidebar to load all recent conversations:

```javascript
var list = document.querySelector('.msg-conversations-container__conversations-list');
if (list) list.scrollTop = list.scrollHeight;
```

Keep scrolling until conversation timestamps are older than `lastMessageTimestamp` from sync state (or 7 days for first run).

### 3b. Get conversation list

Extract all visible conversations from the sidebar. The conversation names and timestamps can be found in `h3` headings within the conversation list:

```javascript
var headings = document.querySelectorAll('h3');
// Each h3 contains a contact name
```

Filter out:
- Sponsored messages (preview contains "Sponsored")
- Conversations older than last sync timestamp

### 3c. Process each conversation

For each conversation to sync:

1. **Click the conversation by name** — find the `h3` heading with the contact's name and click it:
```javascript
var headings = document.querySelectorAll('h3');
var target = null;
headings.forEach(function(h) { if(h.textContent.trim() === 'Contact Name') target = h; });
if(target) target.click();
```
Note: Generic card selectors like `.msg-conversation-card__content--selectable` are unreliable. Always click by name via `h3` headings.

2. **Wait 3 seconds** for thread to load
3. **Read thread text** from `.msg-s-message-list-content` via `innerText`

### 3d. Parse messages from thread text

**Date headers:** Lines matching `^(TODAY|YESTERDAY|MONDAY|...|SUNDAY)$` or `^[A-Z]{3,}\s+\d{1,2}$`

Resolve day names to actual dates based on today's date:
```
TODAY = today's date
YESTERDAY = today - 1
Then count backwards: if today is Tuesday, MONDAY = yesterday, SUNDAY = 2 days ago, etc.
```

**Message headers:** Lines matching `^(.+?)\s{2,}(\d{1,2}:\d{2}\s*(?:AM|PM))$`

**Body:** All lines after the header until the next header or date divider.

**SKIP these lines (NOT message content):**
- `"View X's profile"` / `"sent the following message"`
- `"Download"` / `"NNN KB"` / filenames ending in `.pdf`
- `"Scroll quick replies..."` / `"Reply to conversation with ..."`
- LinkedIn quick reply suggestion text that appears AFTER "Scroll quick replies"

**Direction:** If sender contains "Apoorva" → outbound, else → inbound.

### 3e. Find or create contact

For each conversation, match the contact name to the CRM:

1. First try exact match by name in existing outreach contacts via `linkedinSync:listAllContacts`
2. Fuzzy match: try first name match
3. If no match found → **visit the person's LinkedIn profile** (from the conversation header link) to get their actual company, then **create new outreach company + contact** using `linkedinSync:ensureOutreachContact`

### 3f. Dedup and log messages

For each parsed message newer than `lastMessageTimestamp`:

1. **Check for duplicates:**
```bash
npx convex run --no-push linkedinSync:messageExists '{
  "contactId": "...",
  "body": "...",
  "sentAt": ...
}'
```

2. **If not duplicate, create:**
```bash
npx convex run --no-push outreachMessages:createFromSync '{
  "contactId": "...",
  "companyId": "...",
  "channel": "linkedin_dm",
  "body": "...",
  "sentAt": ...,
  "direction": "outbound|inbound"
}'
```

---

## Step 4 — Update Sync State

After all three phases complete:

### 4a. Update Convex

```bash
npx convex run --no-push linkedinSyncState:upsert '{
  "userId": "...",
  "lastRunAt": ...(now epoch)...,
  "lastConnectionName": "...(newest connection)...",
  "lastConnectionDate": "...(newest connection date)...",
  "totalConnectionsSynced": ...,
  "lastInvitationName": "...(first pending invitation)...",
  "totalInvitationsSynced": ...,
  "lastMessageContactName": "...(last conversation processed)...",
  "lastMessageBody": "...(first 100 chars of newest message)...",
  "lastMessageTimestamp": ...(epoch of newest message)...,
  "totalMessagesSynced": ...
}'
```

### 4b. Update memory file

Write to: `/Users/apoorva1509/.claude/projects/-Users-apoorva1509-conductor-repos-career-ops-v1/memory/reference_linkedin_sync.md`

```markdown
---
name: LinkedIn sync state
description: Last sync timestamp and cursors for /linkedin-sync skill — check before running sync
type: reference
---

Last sync: {date} at {time}

## Connections
- Synced up to: {lastConnectionName} (Connected on {lastConnectionDate})
- Total synced this run: {N}
- Cumulative: {total}

## Sent Invitations
- Pending invitations synced: {N}
- Last: {lastInvitationName}

## Messages
- Conversations processed: {N}
- Last message: "{lastMessageBody...}" from {lastMessageContactName}
- Newest message timestamp: {date time}
- Total messages synced this run: {N}
```

Also update MEMORY.md index if the file is new.

### 4c. Close browser

```bash
agent-browser close
```

---

## Step 5 — Print Summary

Show a clean summary:

```
LinkedIn Sync Complete
======================
Connections:  {N} new (up to {name}, {date})
Invitations:  {N} pending synced
Messages:     {N} new across {M} conversations
Duration:     {time}

New companies created: {list}
New contacts created:  {list}
```

---

## Deduplication & Uniqueness

The system enforces uniqueness at multiple levels:

### outreachCompanies (priority: linkedinUrl > domain > normalized name)
- `ensureOutreachContact` looks up companies in this order:
  1. **`companyLinkedinUrl`** via the `by_user_and_linkedin_url` index, with normalization (protocol/`www.`/trailing slash stripped, lowercased)
  2. **`companyDomain`** via the `by_user_and_domain` index
  3. **Normalized `companyName`** — strips spaces, punctuation, and common corp suffixes so "Wardly AI", "WardlyAI", "Wardly.AI", and "wardly ai inc" collapse into a single record
- When an existing company is matched, missing `linkedinUrl` / `domain` / `logoUrl` are backfilled from the new payload.
- **Pass `companyLinkedinUrl` whenever the profile has a company link.** It is the only field that is reliably globally unique for a company.

### outreachContacts (by LinkedIn URL — global)
- `ensureOutreachContact` checks the `by_linkedin_url` index **across ALL companies** before creating
- Handles URL normalization (with/without trailing slash)
- If a contact already exists under "Unknown" and is being synced with a real company, it **auto-moves** the contact to the correct company
- Also checks by name within the target company as a secondary dedup

### people table (by LinkedIn URL)
- `logConnection` checks the `by_linkedin` index on the people table before creating
- Falls back to name matching if no LinkedIn URL match

### connectionRequests (by personId + companyId)
- `logConnection` checks for existing requests before creating
- If a request already exists, it updates the status (e.g., pending → accepted) instead of creating a duplicate

### outreachMessages (by body + timestamp)
- `messageExists` checks for messages with identical body text within a 24-hour window

---

## Available Convex Functions

### Core sync functions
| Function | Type | Purpose |
|----------|------|---------|
| `linkedinSyncState:findUserId` | internalQuery | Get the clerkTokenIdentifier for CLI sync |
| `linkedinSyncState:get` | internalQuery | Get last sync state by userId |
| `linkedinSyncState:upsert` | internalMutation | Update sync cursors |
| `linkedinSync:ensureOutreachContact` | internalMutation | Find/create company + contact (deduplicates globally by LinkedIn URL). Accepts `connectionStatus` ("pending"/"accepted") |
| `linkedinSync:listAllContacts` | internalQuery | List all outreach contacts with company info |
| `linkedinSync:messageExists` | internalQuery | Check if a message already exists (dedup) |
| `linkedinLog:logConnection` | internalMutation | Log person + company + connection request (deduplicates) |
| `outreachMessages:createFromSync` | internalMutation | Create a message without auth |

### Cleanup functions
| Function | Type | Purpose |
|----------|------|---------|
| `linkedinSync:deleteOutreachContact` | internalMutation | Delete a contact and all its messages |
| `linkedinSync:deleteOrphanCompany` | internalMutation | Delete a company only if it has zero remaining contacts |
| `linkedinSync:deleteConnectionRequest` | internalMutation | Delete pending connection requests by LinkedIn URL |
| `linkedinSyncState:deletePerson` | internalMutation | Delete a person and their links/requests |

---

## Important Rules

1. **NEVER skip a contact because they don't have a CRM record.** Always create the outreach company + contact.
2. **NEVER ask the user to log in.** Handle LinkedIn auth silently.
3. **NEVER extract company names from headlines.** Always visit the LinkedIn profile and read the intro card. The company name appears as a standalone line after "Contact info" in the intro card text. Headlines produce garbage company names like "Engineering Leader", "Senior Engineer", "Recruitment Specialist", "Founding Engineer Knowl", "Sr Recruiter EarnIn".
4. **NEVER create contacts under "Unknown" if avoidable.** Visit the profile first. Only use "Unknown" if the profile genuinely shows no company affiliation and no hiring activity.
5. **Filter LinkedIn quick reply suggestions** — they appear after "Scroll quick replies" in thread text.
6. **Dedup everything** — companies by LinkedIn URL > domain > normalized name (always pass `companyLinkedinUrl` when the profile has a company link), contacts by LinkedIn URL globally, people by LinkedIn URL, connection requests by person+company, messages by body+timestamp.
7. **The scrollable container on LinkedIn pages is `main#workspace`**, not the body/window.
8. **`agent-browser eval` returns JSON strings** — always parse the result with `JSON.parse()`.
9. **Save auth state** after every successful login: `agent-browser state save ~/.agent-browser/linkedin-auth.json`
10. **Use `/bin/bash` shell** when running `agent-browser eval "$(cat /tmp/file.js)"` from Node scripts.
11. **Rate limit**: Add 2-3 second pauses between page navigations, profile visits, and conversation clicks to avoid LinkedIn rate limiting.
12. **Date-filter invitations**: Only sync invitations sent within the sync window. Don't sync all 79+ pending invitations from months ago.
13. **Click conversations by name**: Use `h3` headings to find and click conversations by contact name, not generic card CSS selectors.
14. **Connection status is a field, NOT a message.** Pass `connectionStatus: "accepted"` or `"pending"` to `ensureOutreachContact`. NEVER create fake "Connection accepted" inbound messages in `outreachMessages` — the UI derives the pipeline stage from `connectionStatus` on the contact record, not from messages. Messages are for actual human communication only (DMs, emails, connection request notes).
15. **CONVEX_DEPLOYMENT env var**: If `npx convex run` fails with "No CONVEX_DEPLOYMENT set", prefix commands with `CONVEX_DEPLOYMENT=dev:steady-opossum-661`.
