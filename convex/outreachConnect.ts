import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

const TARGET_TITLES = [
  "Founder", "Co-founder", "Co-Founder", "Cofounder",
  "CEO", "CTO", "COO",
  "VP Engineering", "VP of Engineering", "Vice President Engineering",
  "Engineering Manager", "Head of Engineering", "Director of Engineering",
  "Founding Engineer", "Senior Engineer", "Senior Software Engineer",
  "Staff Engineer", "Principal Engineer",
  "Recruiter", "Talent Acquisition", "HR Manager", "People Operations",
  "Technical Recruiter", "Head of Talent",
];

function getTitlePriority(title: string): number {
  const t = title.toLowerCase();
  if (/founder|co-founder|cofounder|ceo|cto|coo/.test(t)) return 1;
  if (/vp|vice president|head of|director/.test(t)) return 2;
  if (/founding engineer|staff|principal/.test(t)) return 3;
  if (/senior/.test(t)) return 4;
  if (/recruiter|talent|hr|people/.test(t)) return 5;
  return 6;
}

function tierForTitle(title: string): "tier1" | "tier2" | "tier3" {
  const p = getTitlePriority(title);
  if (p <= 3) return "tier1";
  if (p <= 4) return "tier3";
  return "tier2";
}

export interface ConnectCandidate {
  name: string;
  title: string;
  headline: string;
  linkedinUrl: string;
  email: string | null;
  photoUrl: string | null;
  priority: number;
  tier: "tier1" | "tier2" | "tier3";
}

// ── Find candidates at a company via Apollo ────────────────

export const findCandidates = action({
  args: {
    companyLinkedinUrl: v.string(),
    role: v.string(),
  },
  handler: async (ctx, { companyLinkedinUrl, role }) => {
    // Extract slug from LinkedIn URL
    const slugMatch = companyLinkedinUrl.match(/\/company\/([^/?]+)/);
    if (!slugMatch) throw new Error("Invalid LinkedIn company URL");
    const slug = slugMatch[1].toLowerCase();

    // Step 1: Enrich company via Apollo (org enrich works on free plan)
    let companyName = slug.charAt(0).toUpperCase() + slug.slice(1);
    let domain: string | null = null;
    let industry: string | null = null;
    let description: string | null = null;
    let logoUrl: string | null = null;

    const apolloKey = process.env.APOLLO_API_KEY;
    if (apolloKey) {
      const domainGuesses = [`${slug}.com`, `${slug}.io`, `${slug}.ai`, `${slug}.co`];
      for (const guess of domainGuesses) {
        try {
          const res = await fetch(
            `https://api.apollo.io/api/v1/organizations/enrich?domain=${guess}`,
            { headers: { "X-Api-Key": apolloKey } }
          );
          if (res.ok) {
            const data = await res.json();
            if (data.organization) {
              companyName = data.organization.name || companyName;
              domain = data.organization.primary_domain || guess;
              industry = data.organization.industry || null;
              description = data.organization.short_description || null;
              logoUrl = data.organization.logo_url || null;
              break;
            }
          }
        } catch { /* try next */ }
      }
    }

    // Step 2: Try Apollo people search first (works on paid plans)
    let candidates: ConnectCandidate[] = [];

    if (apolloKey) {
      try {
        const searchBody: Record<string, unknown> = {
          q_titles: TARGET_TITLES.join("\n"),
          per_page: 25,
        };
        if (domain) {
          searchBody.q_organization_domains = domain;
        } else {
          searchBody.q_organization_name = companyName;
        }

        const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": apolloKey,
          },
          body: JSON.stringify(searchBody),
        });

        if (res.ok) {
          const data = await res.json();
          const people = data.people || [];
          const seen = new Set<string>();

          candidates = people
            .map((p: any) => {
              const name = p.name ?? [p.first_name, p.last_name].filter(Boolean).join(" ");
              const linkedinUrl = p.linkedin_url || null;
              if (!name || !linkedinUrl || seen.has(linkedinUrl)) return null;
              seen.add(linkedinUrl);
              const title = p.title || "";
              return {
                name,
                title,
                headline: p.headline || "",
                linkedinUrl,
                email: p.email || null,
                photoUrl: p.photo_url || null,
                priority: getTitlePriority(title),
                tier: tierForTitle(title),
              };
            })
            .filter(Boolean)
            .sort((a: ConnectCandidate, b: ConnectCandidate) => a.priority - b.priority);
        }
      } catch { /* Apollo failed, fall through to SearXNG */ }
    }

    // Step 3: Fallback to SearXNG web search for LinkedIn profiles at the company
    if (candidates.length === 0) {
      const searxngUrl = process.env.SEARXNG_URL ?? "http://localhost:8888";
      const titleGroups = [
        "Founder Co-founder CEO CTO",
        "VP Engineering Head Engineering Director Engineering",
        "Senior Engineer Staff Engineer Founding Engineer",
        "Recruiter Talent Acquisition HR",
      ];

      const seen = new Set<string>();

      for (const titles of titleGroups) {
        try {
          const query = `site:linkedin.com/in "${companyName}" ${titles}`;
          const searchUrl = `${searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
          const res = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });

          if (res.ok) {
            const data = await res.json();
            const results = data.results || [];

            for (const r of results) {
              const url = r.url || "";
              if (!url.includes("linkedin.com/in/")) continue;
              const cleanUrl = url.split("?")[0].replace(/\/+$/, "");
              if (seen.has(cleanUrl)) continue;
              seen.add(cleanUrl);

              // Parse name and title from search result
              const titleText = r.title || "";
              const contentText = r.content || "";

              // LinkedIn titles are typically "Name - Title - Company | LinkedIn"
              const parts = titleText.split(" - ");
              const name = (parts[0] || "").replace(/ \| LinkedIn$/i, "").trim();
              let title = "";
              if (parts.length >= 3) {
                title = parts[1]?.trim() || "";
              } else if (parts.length === 2) {
                title = parts[1]?.replace(/ \| LinkedIn$/i, "").trim() || "";
              }

              // Try to extract from content/snippet if title is empty
              if (!title && contentText) {
                const snippetMatch = contentText.match(/(?:^|\n)([^·\n]+)/);
                if (snippetMatch) title = snippetMatch[1].trim();
              }

              if (!name || name.length < 2 || name.length > 60) continue;

              // Extract headline from content
              const headline = contentText.slice(0, 120).trim();

              candidates.push({
                name,
                title,
                headline,
                linkedinUrl: cleanUrl,
                email: null,
                photoUrl: null,
                priority: getTitlePriority(title),
                tier: tierForTitle(title),
              });
            }
          }
        } catch { /* search failed, continue */ }
      }

      // Sort and deduplicate
      candidates.sort((a, b) => a.priority - b.priority);
    }

    return {
      company: {
        name: companyName,
        domain,
        industry,
        description,
        logoUrl,
        linkedinUrl: companyLinkedinUrl,
      },
      candidates,
      role,
    };
  },
});

// ── Generate connection request messages via Claude ─────────

const CONTACTO_RULES = `
Write a short LinkedIn connection request. This is from a job seeker who wants to apply for a role at their company.

TONE: Write like a real person texting a professional contact. Casual, direct, slightly informal. NOT like a marketing email or AI-generated template. Think "how a confident 25-year-old engineer would actually DM someone".

STRUCTURE (keep it loose, not formulaic):
- Say hi, mention you're interested in applying for [specific role] at their company
- Drop ONE specific thing you've built that's relevant (not a buzzword list — a real thing)
- Ask if they're open to a quick chat or can point you in the right direction

HARD RULES:
- MAX 300 characters (LinkedIn limit)
- Be direct about intent: you want to apply / are applying for the role
- NO "I came across", "I'm passionate", "hope this finds you well", "I'd love to explore"
- NO buzzword soup ("leveraging", "driving impact", "solving real problems")
- NO forced compliments about their company
- Use contractions (I'm, I've, you're, don't)
- First name only
- Sound like YOU wrote it, not an AI
- NEVER share phone number

GOOD examples:
"Hey Sarah — I'm applying for the Backend Engineer role at Acme. Built a workflow engine handling 10k jobs/day at my current gig, seems super relevant to what you're building. Would you be open to a quick chat?"
"Hi Raj, saw the SRE opening at Bolt. I've been doing exactly this kind of infra work for 2 years — would love to learn more about the team. Happy to share my background if helpful!"
`.trim();

export const generateMessages = action({
  args: {
    candidates: v.array(v.object({
      name: v.string(),
      title: v.string(),
      headline: v.string(),
      linkedinUrl: v.string(),
    })),
    companyName: v.string(),
    companyDescription: v.optional(v.string()),
    companyIndustry: v.optional(v.string()),
    role: v.string(),
    cvSummary: v.string(),
  },
  handler: async (ctx, args) => {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY not configured in Convex environment");
    }

    const systemPrompt = `${CONTACTO_RULES}

Candidate CV summary:
${args.cvSummary}

The candidate is interested in the "${args.role}" role at ${args.companyName}.
${args.companyIndustry ? `Company industry: ${args.companyIndustry}` : ""}
${args.companyDescription ? `Company: ${args.companyDescription}` : ""}`;

    const results: Array<{ linkedinUrl: string; message: string }> = [];

    for (const candidate of args.candidates) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 200,
            system: systemPrompt,
            messages: [{
              role: "user",
              content: `Write a connection request to this person. I'm applying for the ${args.role} role at ${args.companyName}.

Their info:
- Name: ${candidate.name}
- Their title: ${candidate.title || "unknown"}
- Headline: ${candidate.headline || "N/A"}

Return ONLY the message. No quotes, no labels, no explanation. Max 300 chars.`,
            }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          let message = data.content[0]?.text?.trim() || "";
          // Strip wrapping quotes
          if ((message.startsWith('"') && message.endsWith('"')) ||
              (message.startsWith("'") && message.endsWith("'"))) {
            message = message.slice(1, -1);
          }
          if (message.length > 300) message = message.slice(0, 297) + "...";
          results.push({ linkedinUrl: candidate.linkedinUrl, message });
        } else {
          results.push({ linkedinUrl: candidate.linkedinUrl, message: "" });
        }
      } catch {
        results.push({ linkedinUrl: candidate.linkedinUrl, message: "" });
      }
    }

    return results;
  },
});

// ── Generate DM messages for already-connected contacts ─────

const DM_RULES = `
Write a LinkedIn DM to someone I'm already connected with. I want to apply for a specific role at their company.

TONE: Friendly, direct, like messaging someone you've met briefly. Not formal, not salesy.

STRUCTURE:
- Quick hello + context (we're connected, I saw the role)
- 2-3 sentences about why I'm a strong fit (specific things I've built, not buzzwords)
- Mention I'm attaching my resume for reference
- Clear ask: referral, intro to hiring manager, or general advice

RULES:
- Keep it under 500 characters (short enough to read in 30 seconds)
- Use contractions, be natural
- NO "I'm passionate about", "I came across", "hope this finds you well"
- NO buzzword soup
- Be specific about what you've done, not vague claims
- Mention attaching resume naturally (e.g. "attaching my resume in case it's helpful")
`.trim();

export const generateDmMessages = action({
  args: {
    candidates: v.array(v.object({
      name: v.string(),
      title: v.string(),
      headline: v.string(),
      linkedinUrl: v.string(),
    })),
    companyName: v.string(),
    companyDescription: v.optional(v.string()),
    role: v.string(),
    cvSummary: v.string(),
  },
  handler: async (ctx, args) => {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY not configured in Convex environment");
    }

    const systemPrompt = `${DM_RULES}

My background:
${args.cvSummary}

I'm applying for the "${args.role}" role at ${args.companyName}.
${args.companyDescription ? `About the company: ${args.companyDescription}` : ""}`;

    const results: Array<{ linkedinUrl: string; message: string }> = [];

    for (const candidate of args.candidates) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 300,
            system: systemPrompt,
            messages: [{
              role: "user",
              content: `Write a DM to ${candidate.name} (${candidate.title || "works at " + args.companyName}). I'm applying for the ${args.role} role. I'll be attaching my resume.

Return ONLY the message. No quotes, no labels. Max 500 chars.`,
            }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          let message = data.content[0]?.text?.trim() || "";
          if ((message.startsWith('"') && message.endsWith('"')) ||
              (message.startsWith("'") && message.endsWith("'"))) {
            message = message.slice(1, -1);
          }
          results.push({ linkedinUrl: candidate.linkedinUrl, message });
        } else {
          results.push({ linkedinUrl: candidate.linkedinUrl, message: "" });
        }
      } catch {
        results.push({ linkedinUrl: candidate.linkedinUrl, message: "" });
      }
    }

    return results;
  },
});

// ── Save approved connections to the outreach tracker ───────

export const saveAndSend = action({
  args: {
    companyName: v.string(),
    companyDomain: v.optional(v.string()),
    companyLinkedinUrl: v.string(),
    companyDescription: v.optional(v.string()),
    companyIndustry: v.optional(v.string()),
    companyLogoUrl: v.optional(v.string()),
    role: v.string(),
    approved: v.array(v.object({
      name: v.string(),
      title: v.string(),
      headline: v.string(),
      linkedinUrl: v.string(),
      email: v.optional(v.string()),
      photoUrl: v.optional(v.string()),
      tier: v.union(v.literal("tier1"), v.literal("tier2"), v.literal("tier3")),
      message: v.string(),
      messageType: v.union(v.literal("connection"), v.literal("dm")),
    })),
  },
  handler: async (ctx, args): Promise<{ companyId: string; results: Array<{ name: string; status: string; contactId?: string }> }> => {
    // Step 1: Find or create the company
    const existingCompanies: any[] = await ctx.runQuery(api.outreachCompanies.list);
    let companyId: any = existingCompanies.find(
      (c: any) => c.linkedinUrl === args.companyLinkedinUrl ||
        (c.domain && args.companyDomain && c.domain === args.companyDomain)
    )?._id;

    if (!companyId) {
      companyId = await ctx.runMutation(api.outreachCompanies.create, {
        name: args.companyName,
        domain: args.companyDomain,
        linkedinUrl: args.companyLinkedinUrl,
        description: args.companyDescription,
        logoUrl: args.companyLogoUrl,
        isYcBacked: false,
        roleAppliedFor: args.role,
        status: "active",
      });
    }

    // Step 2: Create contacts and log messages
    const results: Array<{ name: string; status: string; contactId?: string }> = [];

    for (const person of args.approved) {
      try {
        // Check for existing contact
        const existingContacts = await ctx.runQuery(api.outreachContacts.listByCompany, { companyId });
        const existing = existingContacts.find(
          (c: any) => c.linkedinUrl === person.linkedinUrl
        );

        let contactId: string;
        if (existing) {
          contactId = existing._id;
        } else {
          contactId = await ctx.runMutation(api.outreachContacts.create, {
            companyId,
            name: person.name,
            title: person.title,
            linkedinUrl: person.linkedinUrl,
            email: person.email,
            profilePictureUrl: person.photoUrl,
            headline: person.headline,
            source: "apollo",
          });
        }

        // Log the message to outreach tracker
        await ctx.runMutation(api.outreachMessages.create, {
          contactId: contactId as any,
          companyId,
          channel: person.messageType === "dm" ? "linkedin_dm" : "linkedin_connection",
          body: person.message,
          sentAt: Date.now(),
          direction: "outbound",
        });

        results.push({ name: person.name, status: "sent", contactId });
      } catch (err: any) {
        results.push({ name: person.name, status: `error: ${err.message}` });
      }
    }

    return { companyId, results };
  },
});
