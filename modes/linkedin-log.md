# Mode: linkedin-log — Screenshot-to-CRM Logger

Log LinkedIn connections from screenshots directly into the outreach CRM.

## When to Use

User drops a screenshot showing a LinkedIn profile, connection acceptance, or message thread.

## Step 1 — Read the Screenshot

Use the Read tool on the image file. Extract:

1. **Person name** — full name visible on the profile/message
2. **Title/role** — their current job title (e.g., "Sr. Recruiter", "CTO", "Engineering Manager")
3. **Company** — the company they work at
4. **LinkedIn URL** — if visible in the browser URL bar or profile link
5. **Message content** — if a message/note is visible in the screenshot (connection request note, DM, etc.)
6. **Connection status** — infer from context:
   - Profile page with "Connect" button = not yet connected (`suggested`)
   - "Pending" or "Sent" indicator = request sent (`pending`)
   - Message thread / "Connected" / "1st" badge = already connected (`accepted`)
   - Profile with "Follow" only = `ignored` or no action

## Step 2 — Infer Company Domain

Derive the company domain from the company name:
- "Google" → `google.com`
- "Stripe" → `stripe.com`
- "Acme Corp" → `acme.com`

If unsure, ask the user.

## Step 3 — Classify Contact Type

Map the person's role to a `contactType`:

| Role pattern | contactType |
|-------------|-------------|
| Recruiter, Talent Acquisition, TA | `recruiter` |
| Hiring Manager, Manager of [team], Director of [team] | `hiring_manager` |
| CEO, CTO, CXO, Co-founder, Founder | `founder` |
| VP, SVP, EVP, Chief, Head of | `executive` |
| Same/similar level role as user's targets | `peer` |
| Everything else | `other` |

## Step 4 — Create Records in Convex

Execute these mutations in order:

### 4a. Find or create the company
```
companies.findOrCreateByDomain({
  domain: "{inferred domain}",
  name: "{company name}",
  linkedinUrl: "{company linkedin url if visible}"
})
→ returns companyId
```

### 4b. Find or create the person
```
people.findOrCreate({
  name: "{person name}",
  linkedinUrl: "{linkedin url if available}"
})
→ returns personId
```

### 4c. Link person to company
```
personCompanyLinks.findOrCreate({
  personId,
  companyId,
  type: "{contactType — use same value as contactType or map: recruiter→recruiter, hiring_manager→hiring_manager, founder→founder, executive→employee, peer→employee, other→employee}",
  status: "active",
  title: "{their job title}",
  source: "linkedin"
})
```

### 4d. Create connection request
```
connectionRequests.create({
  agentId: "{user's active agent ID}",
  personId,
  companyId,
  contactRole: "{their full job title}",
  contactType: "{classified type from Step 3}",
  sentDate: Date.now(),
  status: "{inferred status from Step 1}",
  noteWithRequest: {true if a connection note was visible},
  messageSent: {true if a message was exchanged},
  messageDate: {Date.now() if message was sent},
  notes: "{message content if visible, or brief context}"
})
```

## Step 5 — Find the Agent ID

Before creating records, you need the user's active agent. Query for it:
- Use the user's person ID to find their agent with status "active" and type "job_hunter"
- If multiple agents exist, use the first active one
- If no agent exists, tell the user they need to set one up first

## Step 6 — Link to Existing Leads

After creating the connection request, check if the company has any existing `agentItems` with type `job_lead`. If found:
- Update the connection request with `linkedToLeadId`
- Tell the user: "Linked to your {role} lead at {company}"

## Step 7 — Confirm

Show a clean summary:

```
Logged: {Name} ({Title}) @ {Company}
Status: {connected/pending/suggested}
{Message: "excerpt..." if applicable}
{Linked to: Sr. AI Engineer lead — if applicable}
```

## Step 8 — Save Tailored Resume (if applicable)

If a tailored resume PDF was generated for this company (via the `job-apply` skill or any other flow), upload it to Convex file storage and link it to the outreach company:

1. **Generate upload URL**: Call `outreachCompanies.generateResumeUploadUrl` (mutation, requires auth) or use the internal equivalent
2. **Upload the PDF**: POST the file to the upload URL with `Content-Type: application/pdf`
3. **Link to company**: Call `outreachCompanies.linkResumeInternal` (internal mutation, no auth):
   ```
   outreachCompanies.linkResumeInternal({
     id: "{outreachCompanyId}",
     storageId: "{returned storageId}",
     fileName: "{company-name}-resume.pdf"
   })
   ```

If the outreach company doesn't exist yet, create it first via `outreachCompanies.create` or `addCompanyWithEnrichment`.

The resume will then be viewable/downloadable from the company card in the outreach tracker UI.

## Rules

- Keep it fast. One screenshot = one confirmation. No unnecessary questions.
- If multiple people are visible in the screenshot (e.g., a search results page), process ALL of them and show a batch summary.
- If the screenshot is unclear or you can't extract the info, ask the user to clarify rather than guessing.
- Always use the Read tool to view the screenshot — never ask the user to describe it.
- If the user provides additional context with the screenshot ("connected with her about the AI role"), incorporate that into the notes.
- **Always save tailored resumes** — if a resume PDF was generated for the company during this session or a prior one, upload it to the outreach company record. Check `output/` directory for existing PDFs matching the company name.
