/**
 * Phases 1-5: Job discovery, company intelligence, decision maker research.
 */

import Anthropic from "@anthropic-ai/sdk";
import { batchSearch, search } from "./serper.js";
import { scanPortals } from "./portal-scanner.js";
import { checkLiveness, scrapeJD } from "./jd-scraper.js";
import { classifyArchetype } from "./archetype-classifier.js";
import {
  readLinkedInProfile,
  searchLinkedInPerson,
  findCompanyLinkedIn,
  getCompanyPeople,
} from "./linkedin.js";
import type {
  AgentConfig,
  DiscoveredJob,
  ClassifiedJob,
  CompanyIntel,
  DecisionMaker,
  DecisionMakerCandidate,
  SearchResult,
  WorkMode,
} from "./types.js";

// ── Job Meta Extraction ─────────────────────────────────────

function extractJobMeta(text: string): { location: string | undefined; workMode: WorkMode } {
  const lower = text.toLowerCase();

  // Work mode detection
  let workMode: WorkMode = "unknown";
  const remotePatterns = /\b(fully remote|100% remote|remote[- ]first|remote[- ]only|work from (home|anywhere))\b/;
  const hybridPatterns = /\b(hybrid|flex(ible)? (work|location)|(\d) days? (in[- ]office|on[- ]site))\b/;
  const onsitePatterns = /\b(on[- ]?site only|in[- ]office|office[- ]based|must be (located|based) in|relocation required)\b/;

  if (remotePatterns.test(lower)) workMode = "remote";
  else if (hybridPatterns.test(lower)) workMode = "hybrid";
  else if (onsitePatterns.test(lower)) workMode = "onsite";

  // Location extraction
  let location: string | undefined;
  const locationPatterns = [
    /(?:location|office|based in|headquartered in|hq)[:\s]+([A-Z][a-zA-Z\s,]+?)(?:\.|;|\n|$)/,
    /(?:Location)[:\s]+([^\n]+)/,
  ];
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      location = match[1].trim().replace(/[,\s]+$/, "").slice(0, 80);
      break;
    }
  }

  return { location, workMode };
}

let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

// ── Known H1B Sponsors ───────────────────────────────────────

const H1B_SPONSORS = new Set([
  "google", "meta", "amazon", "apple", "microsoft", "nvidia", "openai",
  "anthropic", "databricks", "snowflake", "stripe", "airbnb", "uber",
  "lyft", "doordash", "coinbase", "robinhood", "figma", "notion",
  "vercel", "supabase", "retool", "airtable", "datadog", "elastic",
  "confluent", "hashicorp", "mongodb", "cloudflare", "palo alto networks",
  "crowdstrike", "zscaler", "okta", "twilio", "plaid", "square",
  "block", "salesforce", "adobe", "oracle", "ibm", "intel", "qualcomm",
  "broadcom", "cisco", "vmware", "palantir", "anduril", "scale ai",
  "cohere", "mistral", "hugging face", "stability ai", "runway",
  "midjourney", "jasper", "writer", "grammarly", "duolingo",
]);

// ── Known VCs ────────────────────────────────────────────────

const KNOWN_VCS = [
  "a16z", "andreessen", "sequoia", "accel", "benchmark", "greylock",
  "index ventures", "lightspeed", "kleiner perkins", "founders fund",
  "general catalyst", "bessemer", "insight partners", "tiger global",
  "coatue", "addition", "thrive capital", "ribbit", "y combinator", "yc",
];

// ── Email Guessing ──────────────────────────────────────────

function guessEmails(name: string, domain: string): string[] {
  if (!name || !domain) return [];
  const parts = name.toLowerCase().trim().split(/\s+/);
  if (parts.length < 2) return [];
  const first = parts[0].replace(/[^a-z]/g, "");
  const last = parts[parts.length - 1].replace(/[^a-z]/g, "");
  if (!first || !last) return [];
  return [
    `${first}@${domain}`,
    `${first}.${last}@${domain}`,
    `${first[0]}${last}@${domain}`,
    `${first}${last[0]}@${domain}`,
    `${first}_${last}@${domain}`,
    `${last}@${domain}`,
  ];
}

const PHONE_REGEX = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// ── Known Tech ───────────────────────────────────────────────

const KNOWN_TECH = [
  "react", "next.js", "typescript", "python", "go", "rust", "java",
  "kubernetes", "docker", "terraform", "aws", "gcp", "azure",
  "postgresql", "redis", "kafka", "elasticsearch", "mongodb",
  "graphql", "grpc", "fastapi", "django", "flask", "node.js",
  "pytorch", "tensorflow", "ray", "spark", "airflow", "dbt",
  "snowflake", "databricks", "langchain", "llamaindex",
];

// ── Phase 2: Job Discovery ───────────────────────────────────
//
// Primary: portal-scanner (Greenhouse/Lever/Ashby APIs + HTML scrape from portals.yml)
// No external search API (Serper/SearXNG) needed for job discovery.

export async function discoverJobs(
  config: AgentConfig
): Promise<DiscoveredJob[]> {
  console.log(`[discovery] Scanning portals for: ${config.targetRoles.join(", ")}`);
  const jobs = await scanPortals(config.targetRoles);
  console.log(`[discovery] Found ${jobs.length} unique jobs from portals`);
  return jobs;
}

// ── Phase 2b: Liveness + Scraping + Classification ───────────

export async function processJobs(
  jobs: DiscoveredJob[]
): Promise<ClassifiedJob[]> {
  const results: ClassifiedJob[] = [];
  const total = jobs.length;
  const BATCH_SIZE = 5;
  let dead = 0;

  console.log(`[process] Processing ${total} jobs in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(total / BATCH_SIZE);
    console.log(`[process] Batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, total)} of ${total})...`);

    const batchResults = await Promise.allSettled(
      batch.map(async (job) => {
        const isLive = await checkLiveness(job.url);
        if (!isLive) return null;

        const jdText = await scrapeJD(job);
        const textForClassification = jdText ?? job.snippet ?? "";
        const { id: archetype, method } =
          await classifyArchetype(textForClassification);
        const { location, workMode } = extractJobMeta(textForClassification);

        return {
          ...job,
          archetype,
          archetypeConfidence: method,
          jdText: jdText ?? undefined,
          isLive: true,
          location,
          workMode,
        } as ClassifiedJob;
      })
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      } else if (result.status === "fulfilled" && !result.value) {
        dead++;
      }
    }

    console.log(`[process]   → ${results.length} live, ${dead} dead so far`);

    // Rate limit pause between batches to avoid 429s on Claude API
    if (i + BATCH_SIZE < total) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`[process] Done: ${results.length} live, ${dead} dead, classified jobs`);
  return results;
}

// ── Phase 3: Company Intelligence ────────────────────────────

export async function buildCompanyIntel(
  companyName: string,
  domain?: string
): Promise<CompanyIntel> {
  const queries = [
    { query: `"${companyName}" funding round raised investment 2025 2026`, num: 8 },
    { query: `"${companyName}" product launch announcement feature 2025 2026`, num: 8 },
    { query: `"${companyName}" hiring jobs site:greenhouse.io OR site:lever.co OR site:jobs.ashbyhq.com`, num: 10 },
    { query: `"${companyName}" challenges problems review site:glassdoor.com OR site:teamblind.com`, num: 6 },
    { query: `"${companyName}" AI "machine learning" LLM "generative AI"`, num: 8 },
    { query: `"${companyName}" competitor alternative comparison`, num: 6 },
    { query: `"${companyName}" CTO "VP Engineering" "Head of AI" site:linkedin.com`, num: 8 },
  ];

  console.log(`[intel] Researching ${companyName} (7 parallel searches)...`);
  const resultMap = await batchSearch(queries);
  const allResults = [...resultMap.values()];

  const [funding, products, hiring, painPoints, aiMaturity, competitors, dms] =
    allResults;

  // Extract structured signals
  const fundingStage = extractFundingStage(funding);
  const fundingDate = extractFundingDate(funding);
  const investors = extractInvestors(funding);
  const launches = extractLaunches(products);
  const maturity = extractAiMaturity(aiMaturity);
  const techStack = extractTechStack([...products, ...hiring, ...aiMaturity]);
  const growthSignals = extractGrowthSignals([...funding, ...products]);
  const competitorNames = extractCompetitors(competitors);
  const rawSnippets = [...funding, ...products, ...painPoints, ...aiMaturity]
    .map((r) => r.snippet)
    .filter(Boolean);

  // Claude Opus synthesis for pain points + market position
  const synthesis = await synthesizeCompanyIntel(companyName, rawSnippets);

  return {
    name: companyName,
    domain: domain ?? `${companyName.toLowerCase().replace(/\s+/g, "")}.com`,
    fundingStage,
    lastFundingAt: fundingDate ?? undefined,
    investors,
    recentLaunches: launches,
    aiMaturity: maturity,
    openRoles: [],
    painPoints: synthesis.painPoints,
    growthSignals,
    competitors: competitorNames,
    marketPosition: synthesis.marketPosition,
    techStack,
    rawSnippets,
  };
}

function extractFundingStage(
  results: SearchResult[]
): CompanyIntel["fundingStage"] {
  const text = results.map((r) => r.snippet).join(" ").toLowerCase();
  if (/series c|series d|series e/i.test(text)) return "series-c+";
  if (/series b/i.test(text)) return "series-b";
  if (/series a/i.test(text)) return "series-a";
  if (/seed|pre-seed/i.test(text)) return "seed";
  if (/ipo|public/i.test(text)) return "public";
  return undefined;
}

function extractFundingDate(results: SearchResult[]): string | null {
  for (const r of results) {
    if (r.date) return r.date;
    const match = r.snippet.match(
      /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i
    );
    if (match) return match[0];
  }
  return null;
}

function extractInvestors(results: SearchResult[]): string[] {
  const text = results.map((r) => r.snippet).join(" ").toLowerCase();
  return KNOWN_VCS.filter((vc) => text.includes(vc.toLowerCase()));
}

function extractLaunches(results: SearchResult[]): string[] {
  return results
    .filter((r) =>
      /launch|announc|releas|introduc|new feature/i.test(r.snippet)
    )
    .map((r) => r.title)
    .slice(0, 5);
}

function extractAiMaturity(
  results: SearchResult[]
): CompanyIntel["aiMaturity"] {
  const text = results.map((r) => r.snippet).join(" ").toLowerCase();
  let score = 0;
  if (/\bllm\b/i.test(text)) score += 2;
  if (/\bgpt\b|\bclaude\b/i.test(text)) score += 2;
  if (/\brag\b|\bvector\b/i.test(text)) score += 2;
  if (/fine[- ]tun/i.test(text)) score += 2;
  if (/\bml\b/i.test(text)) score += 1;
  if (/neural|model/i.test(text)) score += 1;
  if (/\bai\b/i.test(text)) score += 1;

  if (score >= 8) return "core";
  if (score >= 4) return "scaling";
  if (score >= 2) return "early";
  return "unknown";
}

function extractTechStack(results: SearchResult[]): string[] {
  const text = results.map((r) => r.snippet).join(" ").toLowerCase();
  return KNOWN_TECH.filter((tech) => text.includes(tech.toLowerCase()));
}

function extractGrowthSignals(results: SearchResult[]): string[] {
  return results
    .filter((r) =>
      /raised|launch|grew|milestone|partnership|acqui|expan/i.test(r.snippet)
    )
    .map((r) => r.title)
    .slice(0, 5);
}

function extractCompetitors(results: SearchResult[]): string[] {
  const names = new Set<string>();
  for (const r of results) {
    const matches = r.snippet.match(
      /(?:vs|versus|alternative to|competitor of|compared to)\s+([A-Z][a-zA-Z]+)/gi
    );
    if (matches) {
      for (const m of matches) {
        const name = m.replace(
          /^(?:vs|versus|alternative to|competitor of|compared to)\s+/i,
          ""
        );
        names.add(name.trim());
      }
    }
  }
  return [...names].slice(0, 5);
}

async function synthesizeCompanyIntel(
  company: string,
  snippets: string[]
): Promise<{ painPoints: string[]; marketPosition: string }> {
  try {
    const client = getAnthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `You are a senior GTM intelligence analyst. Analyse this company research for "${company}" and extract:

1. painPoints: 3-5 specific, concrete pain points this company has RIGHT NOW (not generic industry challenges)
2. marketPosition: 1-2 sentence market positioning

Raw research snippets:
${snippets.slice(0, 20).join("\n---\n")}

Return ONLY valid JSON: {"painPoints":["..."],"marketPosition":"..."}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.warn("[intel] Synthesis failed:", (err as Error).message);
  }
  return { painPoints: [], marketPosition: "Unknown" };
}

// ── Phase 4/5: Decision Maker Discovery ──────────────────────
//
// Multi-channel search: LinkedIn profiles, email contacts, company pages
// Step 1: Parallel searches — LinkedIn, email, general web
// Step 2: Parse results into DecisionMakerCandidate objects
// Step 3: Deduplicate by name, cap at 5

/**
 * Search for decision makers across multiple channels.
 * Returns candidates found via LinkedIn, email search, or company pages.
 */
export async function searchForDecisionMakers(
  companyName: string
): Promise<DecisionMakerCandidate[]> {
  const dms: DecisionMakerCandidate[] = [];
  const seen = new Set<string>();

  // ── Primary: LinkedIn Company Page → People tab ──────────
  try {
    console.log(`  [dm] Searching LinkedIn for ${companyName} company page...`);
    const companyUrl = await findCompanyLinkedIn(companyName);

    if (companyUrl) {
      console.log(`  [dm] Found: ${companyUrl}`);
      const employees = await getCompanyPeople(companyUrl);
      console.log(`  [dm] Found ${employees.length} people on LinkedIn company page`);

      for (const emp of employees) {
        if (seen.has(emp.name.toLowerCase())) continue;
        seen.add(emp.name.toLowerCase());
        dms.push({
          name: emp.name,
          title: emp.title,
          linkedinUrl: emp.profileUrl,
          source: "linkedin",
        });
      }
    } else {
      console.log(`  [dm] No LinkedIn company page found for ${companyName}`);
    }
  } catch (err) {
    console.warn(`  [dm] LinkedIn company search failed: ${(err as Error).message}`);
  }

  // ── Fallback: SearXNG web search (if LinkedIn found < 2) ──
  if (dms.length < 2) {
    const titleKeywords = `CTO CEO Founder "VP Engineering" "Head of Engineering" "Engineering Manager" "Tech Lead" Recruiter "Talent Acquisition" "Hiring Manager" "Senior Software Engineer" "Founding Engineer" "Staff Engineer" "Principal Engineer" SDE`;

    const [searchResults, emailResults] = await Promise.all([
      search(`"${companyName}" ${titleKeywords} site:linkedin.com/in`, 8),
      search(`"${companyName}" ${titleKeywords} email "@" contact`, 6),
    ]);

    // Parse LinkedIn search results
    for (const r of searchResults) {
      if (!r.link.includes("linkedin.com/in/")) continue;
      const nameMatch = r.title.match(/^([A-Z][a-z]+(?: [A-Z][a-z]+)+)/);
      if (!nameMatch) continue;
      const name = nameMatch[1];
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());

      const titleMatch = r.title.match(/(?:[-\u2013\u00b7]\s*)(.+?)(?:\s*\|| at | - |$)/i);
      const title = titleMatch?.[1]?.trim() || r.snippet.slice(0, 60).trim();
      dms.push({ name, title, linkedinUrl: r.link, source: "linkedin" });
    }

    // Parse email results
    for (const r of emailResults) {
      const emailMatch = r.snippet.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (!emailMatch) continue;
      const email = emailMatch[1];
      if (/^(info|hello|support|contact|hr|careers|jobs|noreply|admin)@/i.test(email)) continue;

      const nameFromEmail = email.split("@")[0]
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
      const snippetNameMatch = r.snippet.match(
        /([A-Z][a-z]+ [A-Z][a-z]+)(?:\s*[-,|]\s*(?:CTO|CEO|VP|Head|Director|Lead|Manager|Founder|Co-founder|Recruiter|Talent|Hiring|HR|Senior|Staff|Principal|SDE|Engineer))/
      );
      const name = snippetNameMatch?.[1] ?? nameFromEmail;
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());

      const snippetTitleMatch = r.snippet.match(
        /(?:CTO|CEO|VP[^,]*|Head[^,]*|Director[^,]*|Engineering Manager|Tech Lead|Co-founder|Founder|Recruiter|Talent Acquisition|Hiring Manager|HR Manager|People Operations|Senior Software Engineer|Founding Engineer|Staff Engineer|Principal Engineer|SDE)/i
      );
      const title = snippetTitleMatch?.[0]?.trim() ?? "";
      dms.push({
          name,
          title,
          linkedinUrl: "",
          email,
          source: "email",
        });
      }
  }

  return dms.slice(0, 5);
}

/** @deprecated Use searchForDecisionMakers directly — it now returns candidates */
export function extractDecisionMakers(
  results: SearchResult[],
  _company: string,
  _maxDMs = 5
): DecisionMakerCandidate[] {
  // Legacy compatibility — searchForDecisionMakers now returns candidates directly
  return results as unknown as DecisionMakerCandidate[];
}

// ── Phase 6: DM Deep Research ─────────────────────────────────
//
// For each DM candidate:
// Step 1: Two parallel web searches (public content + recent activity)
// Step 2: LinkedIn profile scraping via browser automation
// Step 3: Parse LinkedIn profile with Claude Haiku
// Step 4: Infer "recent focus" with Claude Haiku
// Step 5: Assemble DecisionMaker object

export async function deepResearchDM(
  dm: DecisionMakerCandidate & { company: string },
  anthropicClient?: Anthropic
): Promise<DecisionMaker> {
  const client = anthropicClient ?? getAnthropic();

  // Fix LinkedIn URL if it's not a valid /in/ profile link
  let linkedinUrl = dm.linkedinUrl;
  if (!linkedinUrl?.includes("linkedin.com/in/")) {
    const found = await searchLinkedInPerson(dm.name, dm.company);
    if (found) linkedinUrl = found;
  }

  // Step 1: Two parallel web searches + LinkedIn profile read + email/phone search
  const [contentResults, focusResults, profileText, contactInfoResults] = await Promise.all([
    // Search 1: Public content — interviews, articles, podcasts, talks
    search(`"${dm.name}" "${dm.company}" interview article podcast talk`, 6),
    // Search 2: Recent activity — time-bounded to last year
    search(`"${dm.name}" "${dm.company}" 2025 2026`, 6),
    // Step 2: LinkedIn profile scraping
    linkedinUrl ? readLinkedInProfile(linkedinUrl) : Promise.resolve(null),
    // Search 3: Contact info — email, phone
    search(`"${dm.name}" "${dm.company}" email OR phone OR contact`, 5),
  ]);

  if (!profileText) {
    console.log(`  Could not read LinkedIn profile for ${dm.name}`);
  }

  // Step 3: Parse LinkedIn profile with Claude Haiku
  let parsedProfile: {
    headline?: string;
    about?: string;
    email?: string;
    phone?: string;
    recentActivity: string[];
    careerHistory: string[];
    skills: string[];
  } = { recentActivity: [], careerHistory: [], skills: [] };

  if (profileText) {
    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Extract structured data from this LinkedIn profile page text for "${dm.name}".

Page text (first 4000 chars):
${profileText.slice(0, 4000)}

Extract:
- headline: their current headline/tagline
- about: their about section (verbatim if present, else empty string)
- email: any email address visible on the profile (empty string if none)
- phone: any phone number visible on the profile (empty string if none)
- recentActivity: array of up to 5 recent posts/comments/likes (text excerpts)
- careerHistory: array of previous companies and roles (e.g. "Senior ML Engineer at Stripe")
- skills: array of top 10 skills listed

Respond with ONLY valid JSON matching that structure.`,
          },
        ],
      });
      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsedProfile = JSON.parse(jsonMatch[0]);
    } catch {
      // Non-blocking — fallback to empty defaults
    }
  }

  // Step 4: Infer "recent focus" with Claude Haiku
  let recentFocus = "";
  const webSnippets = focusResults.map((r) => r.snippet).filter(Boolean);
  const activitySnippets = (parsedProfile.recentActivity ?? []).slice(0, 4);
  const allSignals = [...webSnippets.slice(0, 6), ...activitySnippets];

  // Skip LLM call if no signals exist
  if (allSignals.length > 0) {
    try {
      const numberedWeb = webSnippets
        .slice(0, 6)
        .map((s, i) => `${i + 1}. ${s}`)
        .join("\n");
      const numberedActivity = activitySnippets
        .map((s, i) => `${i + 1}. ${s}`)
        .join("\n");

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content: `Based on these signals about ${dm.name} (${dm.title} at ${dm.company}), what is their primary professional focus RIGHT NOW in 1-2 sentences?

Web mentions:
${numberedWeb || "(none)"}

Recent LinkedIn activity:
${numberedActivity || "(none)"}

Be specific and concrete. Do not hedge. 1-2 sentences only.`,
          },
        ],
      });
      recentFocus =
        response.content[0].type === "text"
          ? response.content[0].text.trim()
          : "";
    } catch {
      // Non-blocking
    }
  }

  // Step 5: Resolve email from all sources
  let resolvedEmail = dm.email || parsedProfile.email || undefined;
  let resolvedPhone = parsedProfile.phone || undefined;

  // Mine contact info search results for emails/phones
  const contactSnippets = contactInfoResults.map((r) => `${r.title} ${r.snippet}`).join(" ");
  if (!resolvedEmail) {
    const foundEmails = contactSnippets.match(EMAIL_REGEX);
    if (foundEmails?.length) {
      // Pick the one most likely to belong to the person (not generic info@, support@, etc.)
      resolvedEmail = foundEmails.find(
        (e) => !e.startsWith("info@") && !e.startsWith("support@") && !e.startsWith("hello@") && !e.startsWith("contact@") && !e.startsWith("noreply@")
      ) ?? foundEmails[0];
    }
  }
  if (!resolvedPhone) {
    const foundPhones = contactSnippets.match(PHONE_REGEX);
    if (foundPhones?.length) {
      // Filter out very short matches (likely not real phones)
      resolvedPhone = foundPhones.find((p) => p.replace(/\D/g, "").length >= 10);
    }
  }

  // Mine LinkedIn profile text directly for email/phone
  if (profileText) {
    if (!resolvedEmail) {
      const profileEmails = profileText.match(EMAIL_REGEX);
      if (profileEmails?.length) {
        resolvedEmail = profileEmails.find(
          (e) => !e.startsWith("info@") && !e.startsWith("support@") && !e.startsWith("hello@")
        ) ?? profileEmails[0];
      }
    }
    if (!resolvedPhone) {
      const profilePhones = profileText.match(PHONE_REGEX);
      if (profilePhones?.length) {
        resolvedPhone = profilePhones.find((p) => p.replace(/\D/g, "").length >= 10);
      }
    }
  }

  // Last resort: guess email from name + company domain
  if (!resolvedEmail && dm.company) {
    // Try to find company domain from LinkedIn URL or web search
    const companyDomain = extractDomainFromResults([...contentResults, ...contactInfoResults], dm.company);
    if (companyDomain) {
      const guesses = guessEmails(dm.name, companyDomain);
      if (guesses.length > 0) {
        // Use the most common pattern: firstname@domain
        resolvedEmail = guesses[0];
        console.log(`  Guessed email for ${dm.name}: ${resolvedEmail} (unverified)`);
      }
    }
  }

  if (resolvedEmail) console.log(`  Email found for ${dm.name}: ${resolvedEmail}`);
  if (resolvedPhone) console.log(`  Phone found for ${dm.name}: ${resolvedPhone}`);

  // Step 6: Assemble DecisionMaker object
  return {
    name: dm.name,
    title: dm.title,
    company: dm.company,
    linkedinUrl,
    email: resolvedEmail,
    phone: resolvedPhone,
    headline: parsedProfile.headline,
    about: parsedProfile.about,
    recentActivity: parsedProfile.recentActivity ?? [],
    careerHistory: parsedProfile.careerHistory ?? [],
    skills: parsedProfile.skills ?? [],
    publicContent: [...contentResults, ...focusResults].map(
      (r) => `${r.title}: ${r.snippet}`
    ),
    recentFocus,
  };
}

/**
 * Try to extract a company domain from search results.
 * Looks for URLs containing the company name.
 */
function extractDomainFromResults(results: SearchResult[], company: string): string | undefined {
  const companyLower = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const r of results) {
    try {
      const url = new URL(r.link);
      const host = url.hostname.replace("www.", "");
      // Check if the domain contains the company name (fuzzy)
      if (host.includes(companyLower) || companyLower.includes(host.split(".")[0])) {
        return host;
      }
    } catch {
      // skip invalid URLs
    }
  }
  return undefined;
}

// ── Visa Sponsorship Check ───────────────────────────────────

// ── Discover jobs from a company (LinkedIn or web) ──────────

export async function discoverJobsFromCompany(
  companyName: string,
  companySlug?: string
): Promise<DiscoveredJob[]> {
  console.log(`[tracker] Discovering jobs for company: ${companyName}`);

  const queries = [
    {
      query: `"${companyName}" hiring jobs site:greenhouse.io OR site:lever.co OR site:jobs.ashbyhq.com`,
      num: 15,
    },
    {
      query: `"${companyName}" careers jobs engineer developer`,
      num: 10,
    },
  ];

  if (companySlug) {
    queries.push({
      query: `site:linkedin.com/jobs "${companyName}"`,
      num: 10,
    });
  }

  const resultsMap = await batchSearch(queries);
  const jobs: DiscoveredJob[] = [];
  const seen = new Set<string>();

  for (const [, results] of resultsMap) {
    for (const r of results) {
      if (!r.url || seen.has(r.url)) continue;
      // Only keep URLs that look like job postings
      const isJobUrl =
        /greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|linkedin\.com\/jobs/.test(
          r.url
        );
      if (!isJobUrl) continue;

      seen.add(r.url);
      const title = r.title
        ?.replace(/\s*[-|–—]\s*.+$/, "")
        .replace(/at .+$/i, "")
        .trim();

      jobs.push({
        company: companyName,
        role: title || "Unknown Role",
        url: r.url,
        jobBoard: r.url.includes("linkedin.com")
          ? "linkedin"
          : r.url.includes("greenhouse.io")
            ? "other"
            : r.url.includes("lever.co")
              ? "other"
              : "other",
        snippet: r.snippet,
      });
    }
  }

  console.log(`[tracker] Found ${jobs.length} job postings for ${companyName}`);
  return jobs;
}

export async function checkVisaSponsorship(
  company: string
): Promise<boolean> {
  if (H1B_SPONSORS.has(company.toLowerCase())) return true;

  const results = await search(
    `"${company}" "H1B" OR "visa sponsorship" site:h1bdata.info OR site:myvisajobs.com`,
    3
  );
  return results.length > 0;
}
