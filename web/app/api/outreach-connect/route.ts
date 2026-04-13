import { NextRequest, NextResponse } from "next/server";

const SEARXNG_URL = process.env.SEARXNG_URL ?? "http://localhost:8888";
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const TARGET_TITLES = [
  "Founder", "Co-founder", "CEO", "CTO", "COO",
  "VP Engineering", "Head of Engineering", "Director of Engineering",
  "Engineering Manager", "Founding Engineer", "Senior Engineer",
  "Staff Engineer", "Principal Engineer",
  "Recruiter", "Talent Acquisition", "HR Manager", "Technical Recruiter",
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

interface Candidate {
  name: string;
  title: string;
  headline: string;
  linkedinUrl: string;
  email: string | null;
  photoUrl: string | null;
  priority: number;
  tier: "tier1" | "tier2" | "tier3";
}

// ── POST /api/outreach-connect ──────────────────────────────
// Body: { companyLinkedinUrl: string, role: string }
// Returns: { company: {...}, candidates: Candidate[] }

export async function POST(req: NextRequest) {
  try {
    const { companyLinkedinUrl, role } = await req.json();

    if (!companyLinkedinUrl || !role) {
      return NextResponse.json({ error: "companyLinkedinUrl and role are required" }, { status: 400 });
    }

    const slugMatch = companyLinkedinUrl.match(/\/company\/([^/?]+)/);
    if (!slugMatch) {
      return NextResponse.json({ error: "Invalid LinkedIn company URL" }, { status: 400 });
    }
    const slug = slugMatch[1].toLowerCase();

    // Step 1: Enrich company via Apollo org enrich (works on free plan)
    let companyName = slug.charAt(0).toUpperCase() + slug.slice(1);
    let domain: string | null = null;
    let industry: string | null = null;
    let description: string | null = null;
    let logoUrl: string | null = null;

    if (APOLLO_API_KEY) {
      const domainGuesses = [`${slug}.com`, `${slug}.io`, `${slug}.ai`, `${slug}.co`];
      for (const guess of domainGuesses) {
        try {
          const res = await fetch(
            `https://api.apollo.io/api/v1/organizations/enrich?domain=${guess}`,
            { headers: { "X-Api-Key": APOLLO_API_KEY } }
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

    // Step 2: Try Apollo people search (paid plans only)
    let candidates: Candidate[] = [];

    if (APOLLO_API_KEY) {
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
            "X-Api-Key": APOLLO_API_KEY,
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
                name, title, headline: p.headline || "", linkedinUrl,
                email: p.email || null, photoUrl: p.photo_url || null,
                priority: getTitlePriority(title), tier: tierForTitle(title),
              };
            })
            .filter(Boolean)
            .sort((a: Candidate, b: Candidate) => a.priority - b.priority);
        }
        // If free plan error, fall through silently to SearXNG
      } catch { /* Apollo failed */ }
    }

    // Step 3: Fallback to SearXNG (runs locally, always available)
    // SearXNG is inconsistent — different queries return different results.
    // Strategy: fire MANY queries in parallel, combine & deduplicate.
    if (candidates.length === 0) {
      const companyLower = companyName.toLowerCase();
      const queries = [
        `"${companyName}" site:linkedin.com/in`,
        `"${companyName}" founder CEO CTO`,
        `"${companyName}" engineer`,
        `"${companyName}" linkedin`,
        `${companyName} founder linkedin.com/in`,
        `${companyName} employees`,
        `"${companyName}" recruiter hiring`,
        `${companyName} linkedin.com/in engineer`,
      ];

      const seen = new Set<string>();

      // Fire all queries in parallel for speed + reliability
      const allResults = await Promise.allSettled(
        queries.map(async (query) => {
          try {
            const searchUrl = `${SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
            const res = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
            if (!res.ok) return [];
            const data = await res.json();
            return (data.results || []) as Array<{ url?: string; title?: string; content?: string }>;
          } catch {
            return [];
          }
        })
      );

      for (const result of allResults) {
        if (result.status !== "fulfilled") continue;
        for (const r of result.value) {
          const url: string = r.url || "";
          if (!url.includes("linkedin.com/in/")) continue;
          if (url.includes("/company/")) continue;
          const cleanUrl = url.split("?")[0].replace(/\/+$/, "");
          if (seen.has(cleanUrl)) continue;

          const titleText: string = r.title || "";
          const contentText: string = r.content || "";
          const combined = `${titleText} ${contentText}`.toLowerCase();

          // Only include results that mention the company
          if (!combined.includes(companyLower) && !combined.includes(slug)) continue;

          seen.add(cleanUrl);

          // Parse "Name - Title - Company | LinkedIn" or "Name - Company | LinkedIn"
          const parts = titleText.split(" - ");
          const name = (parts[0] || "").replace(/ \| LinkedIn$/i, "").trim();
          let title = "";
          if (parts.length >= 3) {
            title = parts[1]?.trim() || "";
          } else if (parts.length === 2) {
            title = parts[1]?.replace(/ \| LinkedIn$/i, "").trim() || "";
          }

          // Skip junk
          if (!name || name.length < 2 || name.length > 60) continue;
          if (name.toLowerCase() === companyLower) continue;
          // If "title" is just the company name, clear it
          if (title.toLowerCase().includes(companyLower)) title = "";

          candidates.push({
            name,
            title,
            headline: contentText.slice(0, 120).trim(),
            linkedinUrl: cleanUrl,
            email: null,
            photoUrl: null,
            priority: getTitlePriority(title),
            tier: tierForTitle(title),
          });
        }
      }

      candidates.sort((a, b) => a.priority - b.priority);
    }

    return NextResponse.json({
      company: { name: companyName, domain, industry, description, logoUrl, linkedinUrl: companyLinkedinUrl },
      candidates,
      role,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
