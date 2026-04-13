# Mode: checkin — Daily Connection Check-in

Two flows. Ask which one:

## Flow 1: Log New Requests

User lists connections they sent today. Parse natural language:
- "sent today: John CTO Acme, Sarah recruiter Bolt, Mike eng Stripe"
- "25 requests: [list]"

For each entry:
1. Parse name, role/title, company
2. Find or create the company in Convex (match by name/domain)
3. Find or create the person in Convex
4. Create a `connectionRequests` record with:
   - `status: "pending"`
   - `sentDate: today`
   - `noteWithRequest`: ask once ("did you send notes with these?") or per-entry if mixed
   - Auto-link to existing `agentItems` job_lead if same company exists

Confirm: "Created X connections across Y companies. Z linked to existing leads."

## Flow 2: Status Update

Pull all `pending` connections older than 3 days. Present numbered list:
```
1. Jane D. @ Stripe (Recruiter, sent 04/08) — 5d
2. Bob K. @ Stripe (Eng Mgr, sent 04/08) — 5d
3. Alice R. @ Google (HM, sent 04/09) — 4d
```

User responds with shorthand:
- "1 accepted, 3 accepted, rest pending"
- "1,2 accepted, 3 ignored"
- "all pending" (skip)

For each accepted:
- Update status to `accepted`
- Draft a follow-up message using `contacto` mode framework (3-phrase, max 300 chars)
- Ask: "Want me to draft messages for the accepted connections?"

## Rules

- Keep it fast. The whole check-in should take under 2 minutes.
- Group output by company when showing results.
- After updating, show summary: "Updated: X accepted, Y ignored, Z still pending."
- If any accepted connections are at companies with open leads, highlight: "Jane at Stripe accepted — you have an active lead there (Sr. AI Engineer)."
