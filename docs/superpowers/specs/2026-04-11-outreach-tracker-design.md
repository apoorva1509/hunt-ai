# Outreach Tracker — Design Spec

## Overview

A personal outreach CRM page (`/outreach-tracker`) for tracking companies the user has connected with, contacts at each company, pipeline steps, message history, and AI-powered follow-up suggestions.

This is separate from the existing agent-based lead/outreach system. It's manually driven — the user adds companies, contacts, logs messages, and gets AI suggestions.

## Data Model

### 5 new Convex tables

#### `outreachCompanies`

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Required |
| `domain` | string | Optional, used for logo/enrichment |
| `logoUrl` | string | Auto-fetched from domain |
| `linkedinUrl` | string | Optional |
| `websiteUrl` | string | Optional |
| `isYcBacked` | boolean | Auto-detected on creation |
| `fundingStage` | string | Optional |
| `description` | string | Optional |
| `userId` | string | Clerk user ID |
| `status` | string | "active" / "paused" / "closed" |
| `roleAppliedFor` | string | Optional — the role title being targeted |

#### `outreachContacts`

| Field | Type | Notes |
|-------|------|-------|
| `companyId` | Id<"outreachCompanies"> | Required |
| `name` | string | Required |
| `title` | string | e.g., "CEO", "CTO" |
| `linkedinUrl` | string | Primary input for enrichment |
| `email` | string | From Apollo |
| `phone` | string | From Apollo |
| `profilePictureUrl` | string | From Apollo or LinkedIn scrape |
| `headline` | string | From LinkedIn |
| `source` | string | "manual" / "apollo" / "linkedin" |
| `apolloData` | object | Raw Apollo response for reference |

#### `outreachSteps`

| Field | Type | Notes |
|-------|------|-------|
| `companyId` | Id<"outreachCompanies"> | Required |
| `label` | string | Free text — e.g., "Applied on Instahyre" |
| `status` | string | "pending" / "done" / "skipped" |
| `order` | number | For drag/reorder |

#### `outreachMessages`

| Field | Type | Notes |
|-------|------|-------|
| `contactId` | Id<"outreachContacts"> | Required |
| `companyId` | Id<"outreachCompanies"> | Required (denormalized for easy querying) |
| `channel` | string | "linkedin_dm" / "linkedin_connection" / "email" / "whatsapp" |
| `body` | string | Full message text |
| `sentAt` | number | Timestamp of when message was sent |
| `direction` | string | "outbound" / "inbound" |

#### `outreachGuidance`

| Field | Type | Notes |
|-------|------|-------|
| `contactId` | Id<"outreachContacts"> | Required |
| `channel` | string | "linkedin" / "email" / "whatsapp" |
| `guidance` | string | Free text — tone, angle, instructions |

## Contact Enrichment

### Flow

1. User pastes a LinkedIn URL
2. Convex action calls **Apollo API free** (`/people/match`) with LinkedIn URL
3. Apollo returns: name, title, email, phone, company details
4. If Apollo misses profile picture or headline, fallback to **LinkedIn public profile scrape** via web fetch (parse public page)
5. Data stored in `outreachContacts` with `source: "apollo"`
6. If Apollo returns nothing, show manual entry form (name, title, email)

### Apollo API

- Free tier: 50 email credits/month
- Endpoint: `POST https://api.apollo.io/api/v1/people/match`
- Auth: API key stored as Convex env var `APOLLO_API_KEY`
- Input: `linkedin_url` field
- Returns: name, title, email, phone, headline, organization

### LinkedIn fallback

- Fetch LinkedIn public profile page via SearxNG or direct web fetch
- Parse for: profile picture URL, headline, recent activity
- No API key needed

## YC Detection

When adding a company:

1. Check company name/domain against YC company directory (web fetch `https://www.ycombinator.com/companies?q={name}`)
2. If match found, set `isYcBacked: true`
3. Auto-create step: "Apply via YC Work at a Startup portal" with status "pending"

## UI / Page Structure

### Page: `/outreach-tracker`

Added to sidebar navigation between existing items.

### Top-level layout

- Header: "Outreach Tracker" + [+ Add Company] button
- Filter tabs: All | Active | Paused | Closed
- List of company cards

### Company card (collapsed)

- Company name + logo + status badge
- YC badge if applicable
- Contact names (inline preview)
- Steps progress bar (3/5 done)
- [Expand] button

### Company card (expanded)

4 sections:

#### Contacts section
- Cards per contact: photo, name, title, LinkedIn link, email
- [+ Add Contact] button — paste LinkedIn URL, triggers enrichment
- Each contact is expandable to show their messages + guidance

#### Steps section
- Checklist with custom step names
- [+ Add Step] — inline input, type name, press Enter
- Click to toggle done/pending/skipped
- Drag to reorder
- Steps auto-created (YC portal) shown with auto-generated badge

#### Messages section (per contact, inside expanded contact)
- List of messages: channel badge, date, body preview (expandable)
- [+ Log Message] — form: channel dropdown, date picker (default today), body textarea, direction (outbound/inbound)
- Messages sorted by date descending

#### Guidance section (per contact, inside expanded contact)
- Per channel (linkedin, email, whatsapp): editable text field
- Placeholder: "Set tone/angle for AI suggestions on this channel..."

### [Suggest Follow-up] button (per contact)

Opens a panel/modal with AI-generated suggestion.

## AI Follow-up Suggestion

### Trigger

[Suggest Follow-up] button on each contact card.

### Prompt context (fed to Claude)

1. **User profile** — reads `cv.md` + `config/profile.yml`
2. **Company context** — name, domain, YC status, role applied for, all steps with status
3. **Contact context** — name, title, headline
4. **Full message history** — all messages to this contact (channel, date, body, direction) + messages to other contacts at same company
5. **Guidance rule** — per-contact per-channel guidance text
6. **Time context** — days since last message

### Output

- Recommended channel
- Draft message
- Brief reasoning (e.g., "It's been 6 days since your last LinkedIn DM, a light nudge works here")

### Post-suggestion actions

- Edit the suggestion
- Copy to clipboard
- Log as sent (auto-fills [+ Log Message] form with the suggestion)

### Implementation

Convex action calling Claude API, same pattern as existing `convex/outreach.ts`.

## Adding a Company — Full Flow

1. Click [+ Add Company]
2. Modal: company name + website URL (optional)
3. On submit, Convex action:
   - Fetches company info from domain (logo, description)
   - Checks if YC-backed
   - If YC, auto-creates "Apply via YC Work at a Startup" step
4. Company card appears, user can add contacts and steps

## Pre-seeded Data

Seed the following on first use:

### Fibr.ai
- Status: active
- Contacts: Ankur Goyal (CEO), Pritam Roy (founder) — enrich via Apollo
- Steps: "LinkedIn cold messages" (done), "Resume shared" (done), "Follow-up" (pending)

### Zenskar
- Status: active
- isYcBacked: check (likely yes)
- Steps: "Instahyre application" (done), "Cold emails" (pending)
- If YC: auto-add "YC Work at a Startup portal" (pending)

### Gushwork.ai
- Status: active
- Contacts: Debangi Chakraborti, Himanshu Bamoria — enrich via Apollo
- Steps: "LinkedIn cold messages" (done), "Follow-up" (pending)

## File Structure

```
convex/
  outreachCompanies.ts    — CRUD queries/mutations for companies
  outreachContacts.ts     — CRUD + enrichment action for contacts
  outreachSteps.ts        — CRUD + reorder for steps
  outreachMessages.ts     — CRUD for messages
  outreachGuidance.ts     — CRUD for guidance rules
  outreachSuggest.ts      — AI follow-up suggestion action
  schema.ts               — add 5 new tables

web/app/(app)/outreach-tracker/
  page.tsx                — main page with company list
  company-card.tsx        — collapsed/expanded company card
  contact-card.tsx        — contact with messages + guidance
  add-company-dialog.tsx  — modal for adding company
  add-contact-dialog.tsx  — modal for adding contact (LinkedIn URL input)
  log-message-dialog.tsx  — modal for logging a message
  suggestion-panel.tsx    — AI follow-up suggestion display
  types.ts                — TypeScript interfaces
  utils.ts                — helper functions

web/hooks/
  use-outreach-tracker.ts — hooks for all outreach tracker queries

web/components/layout/
  sidebar.tsx             — add nav item for outreach tracker
```

## Not in scope

- Auto-importing messages from LinkedIn/email (manual logging only)
- Bulk company import
- Email sending from the app
- Calendar/scheduling integration
- Analytics/reporting dashboard
