---
name: job-apply
description: Evaluate job fit, tailor LaTeX resume, check ATS score, and generate LinkedIn outreach messages for any job link
user_invocable: true
args: job_url
---

# job-apply -- Smart Job Application Pipeline

When invoked with a job URL (or pasted JD), execute this full pipeline:

---

## Step 1: Load Base Resumes

Read both base resumes to understand Apoorva's full background:
- `.claude/skills/job-apply/resumes/ai-engineer-resume.md` -- AI/ML-focused version
- `.claude/skills/job-apply/resumes/fullstack-resume.md` -- Full-stack/SaaS-focused version

Read the LaTeX template:
- `.claude/skills/job-apply/latex-template.tex` -- Base LaTeX structure to modify

---

## Step 2: Research the Job & Company

### 2a: Extract Job Details
If `{{job_url}}` is a URL:
- Use `WebFetch` to get the job posting content
- Extract: company name, role title, location, requirements, responsibilities, tech stack, nice-to-haves, salary range (if listed)

If `{{job_url}}` is pasted JD text:
- Parse the text directly for the same fields

### 2b: Company Research
Use `WebSearch` to find:
- Company LinkedIn page (search: `"{company name}" site:linkedin.com/company`)
- Company size, funding stage, industry, mission
- Recent news or notable achievements
- Tech blog or engineering culture signals

Use `WebFetch` on the LinkedIn company page to extract:
- Employee count, industry, headquarters
- Company description and specialties

### 2c: Compile Company Brief
Present a brief summary:
```
Company: {name}
Industry: {industry}
Size: {size}
Stage: {funding/stage}
HQ: {location}
LinkedIn: {url}
Notable: {1-2 sentences on what makes them interesting}
```

### 2d: Check CRM for Existing Activity

Before proceeding, query the outreach CRM to see if we already have contacts or activity at this company.

**Step 1 — Find the company in Convex:**
```bash
npx convex run --no-push outreachCompanies:list
```
Search the results for a matching company by domain or name (case-insensitive). If found, note the `_id`.

**Step 2 — If company exists, pull contacts and messages:**
```bash
npx convex run --no-push outreachContacts:listByCompany '{"companyId":"COMPANY_ID"}'
npx convex run --no-push outreachMessages:listByCompany '{"companyId":"COMPANY_ID"}'
```

**Step 3 — Classify each contact's connection state:**

For each contact, examine their messages to determine status:
- **Request sent, not accepted**: Has `linkedin_connection` outbound message but NO `linkedin_dm` messages (neither inbound nor outbound). This means the connection request is still pending.
- **Connection accepted, no DM yet**: Has `linkedin_connection` outbound message AND no `linkedin_dm` outbound messages, but the connection was accepted (look for inbound connection message or the presence of DM capability).
- **Connection accepted, DMs exchanged**: Has `linkedin_dm` messages (outbound and/or inbound).
- **No prior contact**: Contact exists but no messages sent yet.

**Step 4 — Present CRM Summary:**
```
CRM Activity for {company}:
- {N} contacts tracked
- {list each contact with name, title, tier, and connection state}
- {N} total messages exchanged
- Resume on file: yes/no
- Jobs tracked: {list any outreachJobs}
```

This CRM data feeds directly into Step 6 (LinkedIn Outreach) to craft context-aware messages.

---

## Step 3: Fit Assessment

Compare the JD requirements against Apoorva's background from both resumes. Score each dimension:

| Dimension | JD Asks | Apoorva Has | Fit |
|-----------|---------|-------------|-----|
| Core Tech Stack | {from JD} | {from resume} | Strong/Partial/Weak |
| Years of Experience | {from JD} | 3+ years | Strong/Partial/Weak |
| Domain Knowledge | {from JD} | {from resume} | Strong/Partial/Weak |
| System Design | {from JD} | {from resume} | Strong/Partial/Weak |
| AI/ML Skills | {from JD} | {from resume} | Strong/Partial/Weak |
| Leadership | {from JD} | {from resume} | Strong/Partial/Weak |

### Overall Fit Score: X/10

**Verdict:**
- 8-10: Excellent fit -- strong match, proceed with tailored resume
- 6-7: Good fit -- some gaps but worth applying, highlight transferable skills
- 4-5: Moderate fit -- significant gaps, apply only if very interested
- 1-3: Poor fit -- recommend skipping unless there's a specific reason

If score < 4, warn: "This role has significant gaps. I'd recommend focusing on better-fit roles. Want to proceed anyway?"

### Key Strengths to Highlight
- List 3-5 specific strengths from Apoorva's background that match the role

### Gaps to Address
- List any missing requirements and how to frame them (transferable skills, quick learner, etc.)

---

## Step 4: Tailor the LaTeX Resume

Based on the fit assessment, decide which base resume is closest (AI Engineer vs Full Stack), then tailor:

### Tailoring Rules:
1. **Summary**: Rewrite to mirror the JD's language and priorities. Lead with the most relevant experience. Include keywords from the JD.

2. **Salesmonk Title**: Use whichever title better matches the role (AI Engineer / Full Stack Engineer / Software Engineer)

3. **Salesmonk Bullets**: Reorder and rewrite to emphasize the most relevant work. Use JD keywords naturally. Keep 4-5 bullets max.

4. **Other Experience**: Keep all positions but adjust bullet emphasis:
   - If role is backend-heavy: emphasize Curelink (Python, Django, APIs)
   - If role is AI-focused: emphasize Writesonic (AI tools) and Salesmonk AI work
   - If role is frontend-focused: add frontend details to Salesmonk bullets

5. **Technical Skills**: Reorder categories and items to put the most relevant first. Add any JD-specific tools Apoorva knows but may not have listed. Remove irrelevant items to reduce noise.

6. **DO NOT fabricate experience or skills.** Only rephrase and reorder existing content.

7. **Bold key terms in bullet points.** Use `\textbf{}` to highlight important technologies, metrics, and impact terms within each `\resumeItem{}`. Examples: `\textbf{Node.js}`, `\textbf{REST APIs}`, `\textbf{99.5\% uptime}`, `\textbf{PostgreSQL}`. This makes the resume scannable and draws attention to relevant keywords. Every bullet should have at least 1-2 bolded terms.

8. **Single page is MANDATORY.** The resume must fit on exactly one page. If content overflows:
   - Reduce older internship bullets to 1 line each
   - Remove the Leadership/Extracurricular section if needed
   - Tighten spacing but keep readability
   - Never go to a second page

### Generate Complete LaTeX
Output the FULL, compilable LaTeX document (not a diff or partial). Use the structure from `latex-template.tex` but with all placeholders filled in with tailored content.

---

## Step 5: ATS Score Check

Evaluate the tailored resume against the JD for ATS compatibility:

### ATS Checklist:
| Check | Status | Notes |
|-------|--------|-------|
| Keywords from JD present in resume | Pass/Fail | List missing keywords |
| Job title match | Pass/Fail | How close is the summary to the role title |
| Skills section has JD technologies | Pass/Fail | List matches and misses |
| Quantified achievements | Pass/Fail | Count metrics (%, numbers) |
| Clean formatting (no tables/graphics) | Pass/Fail | LaTeX compiles to clean text |
| Single page | Pass/Fail | Estimate length |
| Contact info complete | Pass/Fail | Phone, email, LinkedIn, GitHub |

### ATS Score: X/100

If score < 80, suggest specific improvements and regenerate the LaTeX.

### Final LaTeX Output
After ATS optimization, output the final LaTeX inside a code block:
```latex
{final compilable LaTeX}
```

---

## Step 6: LinkedIn Outreach (CRM-Aware)

After delivering the resume, check the CRM data from Step 2d. There are three flows depending on what we already know:

### Flow A: Existing CRM contacts found

If Step 2d found contacts at this company, present them first:

> "Resume is ready! I found **{N} existing contacts** at {company} in your CRM:
> {for each contact: "- **{name}** ({title}) — {connection state}"}
>
> I'll draft follow-up messages for each based on where things stand. Want me to also find new contacts?"

Then draft messages for each existing contact based on their connection state:

#### A1: Request Sent, Not Accepted (InMail)

The connection request is still pending. Draft a LinkedIn **InMail** message (longer format OK, ~500 chars) that:
- Does NOT mention the pending connection request (avoid seeming pushy)
- Opens with something specific about their work/team/product
- Positions Apoorva's relevant experience as a value-add
- Asks for a brief conversation, not a favor
- Attaches or references the tailored resume

```
Subject: {role} at {company} — quick question

Hi {name},

I've been following {company}'s work on {specific product/initiative} — {what impressed you about it}.

I'm an engineer with experience in {1-2 relevant skills from fit assessment}, and I recently {specific achievement that maps to their team's needs}. I'd love to hear more about what the {their team} is working on and whether the {role} might be a good fit.

I've attached my resume for context. Would you have 15 minutes for a quick chat this week?

Best,
Apoorva
```

**Key rules for InMail:**
- Subject line should be specific and reference the role
- Longer than a connection note (300-500 chars body is fine)
- Lead with genuine interest in their work, not "I applied to your job"
- Include a concrete ask (15-min chat, not "let me know your thoughts")
- Mention the resume is attached or offer to share it

#### A2: Connection Accepted, No DM Yet (Resume + Intro)

They accepted the connection — now send a warm DM with the resume:
- Reference the connection acceptance naturally
- Share the tailored resume (mention attaching it or offer a link)
- Highlight 1-2 achievements most relevant to this specific role
- Include a soft ask for a conversation or referral

```
Hi {name}!

Thanks for connecting! I noticed {company} has a {role} opening and I'm really excited about it — especially {specific thing about company/team}.

I've been working on {relevant experience}, including {specific achievement}. I think my background in {skills} could be a great fit for the team.

I've put together a tailored resume — happy to share it here or over a quick chat. Would love to hear your perspective on the role!

Best,
Apoorva
```

**Key rules for accepted-connection DMs:**
- Warm, conversational tone (you're already connected)
- Don't just dump the resume — frame it with context
- If they're a hiring manager: ask about the role directly
- If they're a peer/engineer: ask about team culture and mention the role
- If they're a recruiter: mention you've applied (or will) and share the resume

#### A3: DMs Already Exchanged (Follow-up)

If there are existing DM threads, read the last few messages and draft a **contextual follow-up** that:
- References the previous conversation naturally
- Introduces the specific role you're applying for
- Doesn't repeat information you already shared
- Offers the tailored resume as a new touchpoint

```
Hi {name},

Hope you've been well since we last chatted! I wanted to circle back — I saw the {role} opening at {company} and it really caught my eye.

{Reference to prior conversation: "You mentioned the team was growing" / "Given what you shared about the engineering culture" / etc.}

I've put together a resume tailored to the role — would love to share it and get your take. Any chance you'd have a few minutes this week?

Thanks!
Apoorva
```

### Flow B: No CRM contacts — find new ones

If Step 2d found no existing contacts (or company not in CRM), use the original discovery flow:

> "Resume is ready! Now let's get you a warm intro. Can you share LinkedIn profiles of people you'd like to DM at {company}? These could be:
> - The hiring manager
> - Engineers on the team
> - Recruiters at the company
> - Anyone in your network who works there
>
> Paste their LinkedIn URLs and I'll draft personalized messages for each."

When the user provides LinkedIn profile URLs:

### For each new profile:
1. Use `WebFetch` on the LinkedIn URL to extract:
   - Name, title, company
   - Shared connections or interests (if visible)
   - Their background/experience

2. Generate a personalized connection request + DM based on their role:

**For Hiring Managers / Engineers:**
```
Hi {name},

I came across the {role} opening at {company} and I'm really excited about {specific thing about company/team/product}.

I've been {1-sentence relevant experience highlight} -- for example, {specific achievement that maps to their team's work}.

I'd love to learn more about the team and how I might contribute. Would you be open to a quick chat?

Best,
Apoorva
```

**For Recruiters:**
```
Hi {name},

I recently applied for the {role} position at {company} and wanted to connect directly.

My background in {relevant skills} aligns well with what the team is building -- I've {specific achievement}. I'd love to discuss how I can contribute.

Happy to share more details anytime!

Best,
Apoorva
```

**For Network Connections at the Company:**
```
Hi {name},

Hope you're doing well! I saw that {company} has an opening for {role} and I'm really interested.

Given your experience there, I'd love to hear your perspective on the team and culture. Would you be open to a quick chat?

Thanks!
Apoorva
```

### Customize each message:
- Reference something specific from their profile (shared alma mater, shared tech interest, their blog post, etc.)
- Keep under 300 characters for LinkedIn connection requests, or indicate if it's an InMail (longer OK)
- Adjust tone: more formal for senior leaders, more casual for peers

---

## Output Format

Structure the full response as:

### 1. Company Brief
{company research summary}

### 2. CRM Activity
{existing contacts, connection states, message history — from Step 2d. If no CRM data: "No prior activity found for {company}."}

### 3. Fit Assessment
{scoring table + verdict + strengths/gaps}

### 4. Tailored Resume (LaTeX)
```latex
{full compilable LaTeX}
```

### 5. ATS Score
{checklist table + score}

### 6. LinkedIn Outreach
{CRM-aware messages for existing contacts + prompt for new profiles}

---

## Step Post-Pipeline: Save Resume to CRM

After generating the tailored PDF resume, upload it to the outreach tracker:

1. Find or create the outreach company in Convex (use `outreachCompanies.addCompanyWithEnrichment` or find by domain)
2. Upload the PDF to Convex file storage:
   - Call `outreachCompanies.generateResumeUploadUrl` to get an upload URL
   - POST the PDF file to that URL
   - Call `outreachCompanies.linkResume` with the returned `storageId` and filename
3. The resume will then be viewable/downloadable from the company card in the outreach tracker

---

## Notes
- Always use `WebSearch` and `WebFetch` for research -- never guess company details
- If the job posting is behind a login wall, ask the user to paste the JD text
- If LaTeX has compilation issues, debug and fix before presenting
- Keep the resume to 1 page -- remove less relevant items if needed
- Prioritize recent experience (Salesmonk) over older internships
- **Always save the generated PDF to the outreach CRM** -- the user should be able to preview/download it from the company card
