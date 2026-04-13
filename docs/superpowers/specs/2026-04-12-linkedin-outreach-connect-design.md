# LinkedIn Semi-Automated Outreach Connect

**Date:** 2026-04-12
**Status:** Approved

## Problem

Sending LinkedIn connection requests to relevant people at target companies is tedious. The user wants to give a company LinkedIn URL + job role, have the system find the right people, generate personalized messages, and semi-automate the sending — with approval before every send.

## Solution

A standalone Node.js script (`outreach-connect.mjs`) that:

1. Takes a company LinkedIn URL + target job role
2. Uses Apollo API (free tier, 75 credits/month) to find employees matching target titles
3. Generates personalized 300-char connection requests using Claude Haiku + contacto.md rules
4. Opens each person's LinkedIn profile in the browser
5. Shows a terminal preview and waits for y/n/edit approval
6. Sends via Playwright with human-like typing and random delays
7. Logs everything to a TSV file

## Architecture

```
CLI: node outreach-connect.mjs --company <linkedin-url> --role <job-role>
  │
  ├─ Load cv.md (proof points) + modes/contacto.md (message rules)
  │
  ├─ Apollo: GET /organizations/enrich → company domain + name
  ├─ Apollo: POST /mixed_people/search → candidates[]
  │   Title filter (priority order):
  │     1. Founder / Co-founder / CEO / CTO
  │     2. VP Engineering / Engineering Manager / Head of Engineering
  │     3. Founding Engineer / Senior Engineer / Staff Engineer
  │     4. Recruiter / Talent Acquisition / HR
  │
  ├─ For each candidate:
  │   ├─ Playwright: open LinkedIn profile, take snapshot
  │   ├─ Claude Haiku: generate 300-char connection request
  │   │   Inputs: candidate name/title/headline, company, role, CV, contacto rules
  │   │   Rules: hook → proof point → soft ask, max 300 chars
  │   │   Banned: "I came across", "passionate", "hope this finds you well"
  │   ├─ Terminal prompt: show message, ask y/n/edit
  │   ├─ If approved: Playwright types message + sends connection request
  │   ├─ Random 30-90s delay before next candidate
  │   └─ Log to batch/outreach-log.tsv
  │
  └─ Print summary: X sent, Y skipped, Z errors
```

## Components

### 1. CLI Entry Point (`outreach-connect.mjs`)

Single file, ~300-400 lines. No external framework — uses `process.argv` parsing.

**Required args:**
- `--company` — LinkedIn company URL (e.g., `https://linkedin.com/company/acme`)
- `--role` — Job role being applied for (e.g., "Senior AI Engineer")

**Optional args:**
- `--max` — Max candidates to process (default: 10)
- `--dry-run` — Show messages but don't send

**Environment variables:**
- `APOLLO_API_KEY` — required
- `ANTHROPIC_API_KEY` — required
- `LINKEDIN_STATE_PATH` — optional (default: `~/.suprdash/linkedin-state.json`)

### 2. Apollo Integration

**Step 1: Company enrichment**
```
GET https://api.apollo.io/api/v1/organizations/enrich
  ?domain=<guessed-from-linkedin-url>
  Headers: X-Api-Key: APOLLO_API_KEY
→ { name, domain, linkedin_url, industry, ... }
```

Domain guessing: extract company slug from LinkedIn URL, try `{slug}.com`, `{slug}.io`, `{slug}.ai`.

**Step 2: People search**
```
POST https://api.apollo.io/api/v1/mixed_people/search
  Body: {
    organization_domains: [domain],
    person_titles: [
      "Founder", "Co-founder", "CEO", "CTO",
      "VP Engineering", "Engineering Manager", "Head of Engineering",
      "Founding Engineer", "Senior Engineer", "Staff Engineer",
      "Recruiter", "Talent Acquisition", "HR Manager"
    ],
    per_page: 10
  }
→ { people: [{ name, title, linkedin_url, headline, ... }] }
```

**Credit cost:** ~2 credits per run (1 enrich + 1 search).

### 3. Message Generation

Uses Claude Haiku (`claude-haiku-4-5-20251001`) via Anthropic SDK.

**System prompt includes:**
- contacto.md rules (hook → proof → soft ask, 300 char limit, banned phrases)
- User's CV summary from cv.md
- The target role

**User prompt per candidate:**
```
Generate a LinkedIn connection request for:
- Name: {name}
- Title: {title}
- Headline: {headline}
- Company: {company}
- Role I'm interested in: {role}

Max 300 characters. Follow the contacto rules exactly.
```

**Quality checks (in prompt):**
- You:I ratio >= 2:1
- No banned phrases
- Single CTA
- BYAF close ("no pressure" / "completely understand")

### 4. Browser Automation (Playwright)

Reuses patterns from `runner/job-hunter/linkedin.ts`:

- **Session persistence:** Load/save browser state from `linkedin-state.json`
- **CloakBrowser first**, fall back to standard Playwright chromium
- **Human-like typing:** 35-55ms per character with jitter
- **Profile reading:** Navigate to profile URL, wait for content, extract visible info
- **Connection request:** Click Connect button, paste note, click Send
- **Rate limiting:** Random 30-90 second delay between each send

### 5. Terminal Interaction

Uses Node.js `readline` for interactive prompts:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1/5] Jane Smith — CTO @ Acme Corp
LinkedIn: https://linkedin.com/in/janesmith
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Message (287/300 chars):
"Hi Jane — building AI pipelines at Acme caught my eye. I led a
similar system at Curelink that cut processing time 40%. Would love
to chat about the Senior AI Engineer role. No pressure either way."

[y]es / [n]o / [e]dit > _
```

If `e`: open readline for new message text, show updated preview, re-prompt y/n.

### 6. Logging

**File:** `batch/outreach-log.tsv`

**Columns:**
```
date\tcompany\tname\ttitle\tlinkedin_url\tstatus\tmessage
```

**Statuses:** `sent`, `skipped`, `error`

Dedup: skip candidates whose `linkedin_url` already appears in the log.

## Error Handling

| Error | Handling |
|-------|----------|
| `APOLLO_API_KEY` not set | Exit with clear message |
| `ANTHROPIC_API_KEY` not set | Exit with clear message |
| Apollo returns 0 results | Print "No candidates found", suggest broadening titles |
| LinkedIn session expired | Prompt user to login in opened browser, retry |
| Connection request fails (already connected, pending) | Log as `skipped`, continue |
| Ctrl+C | Save progress, close browser, exit cleanly |
| Playwright timeout | Log as `error`, continue to next candidate |

## Security

- No credentials stored in script — all from environment variables
- Browser state file in user's home directory (not in repo)
- `batch/outreach-log.tsv` is gitignored (batch/ directory)
- Never auto-sends — every message requires explicit approval

## Credit Budget

| Action | Credits | Per Run |
|--------|---------|---------|
| Org enrich | 1 | 1 |
| People search | 1 | 1 |
| **Total** | | **~2** |

75 free credits/month = ~37 company outreach runs.

## Non-Goals

- No email sending (LinkedIn only)
- No follow-up automation (separate feature)
- No web UI (terminal only)
- No People Data Labs integration (Apollo sufficient for now)
