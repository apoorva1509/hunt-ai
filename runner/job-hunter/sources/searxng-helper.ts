/**
 * Shared helper for SearXNG site:-scoped job searches.
 * Used by LinkedIn, Wellfound, Instahyre, and Cutshort adapters.
 */

import { search } from "../serper.js";
import type { DiscoveredJob } from "../types.js";
import type { SourceQuery } from "./types.js";

export async function searxngSiteSearch(
  site: string,
  query: SourceQuery,
  jobBoard: DiscoveredJob["jobBoard"],
  maxResultsPerKeyword = 15,
): Promise<DiscoveredJob[]> {
  const allJobs: DiscoveredJob[] = [];
  const seen = new Set<string>();

  for (const keyword of query.keywords) {
    const q = `site:${site} "${keyword}" "${query.location}"`;
    const results = await search(q, maxResultsPerKeyword);

    for (const r of results) {
      const url = r.link;
      if (seen.has(url)) continue;
      seen.add(url);

      const { company, role } = parseSearchTitle(r.title, r.snippet);
      if (!company || !role) continue;

      allJobs.push({
        company,
        role,
        url,
        jobBoard,
        snippet: r.snippet,
      });
    }
  }

  return allJobs;
}

const LOCATION_WORDS = [
  "india", "bangalore", "bengaluru", "karnataka", "mumbai", "delhi",
  "hyderabad", "ncr", "chennai", "pune", "kolkata", "noida", "gurgaon",
  "gurugram", "ahmedabad", "jaipur", "lucknow", "chandigarh", "kochi",
  "thiruvananthapuram", "coimbatore", "indore", "nagpur", "visakhapatnam",
  "remote", "onsite", "on-site", "hybrid", "worldwide",
  "usa", "uk", "germany", "canada", "australia", "singapore", "dubai",
  "san francisco", "new york", "london", "berlin", "toronto", "sydney",
  "tokyo", "amsterdam", "paris", "zurich", "seattle", "boston",
  "bangkok", "jakarta", "manila", "ho chi minh",
];

const JUNK_PATTERNS = [
  /jobs?\s+in\b/i,
  /hiring\s+in\b/i,
  /jobs?\s+near\b/i,
  /openings?\s+in\b/i,
  /vacancies\s+in\b/i,
  /^\d/,                   // starts with a number
  /^\d+$/,                 // just numbers
];

/**
 * Validate that a string looks like a real company name,
 * not a location, page title, or search artifact.
 */
export function isValidCompanyName(name: string): boolean {
  if (!name || name.trim().length === 0) return false;

  const trimmed = name.trim();
  if (trimmed.length > 60) return false;

  const lower = trimmed.toLowerCase();

  // Reject if it contains a known location word as a whole word
  for (const loc of LOCATION_WORDS) {
    if (lower === loc) return false;
    // Match as whole word (with word boundaries)
    const re = new RegExp(`\\b${loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) return false;
  }

  // Reject junk patterns
  for (const pattern of JUNK_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }

  return true;
}

/**
 * Parse company and role from search result titles.
 * Common patterns:
 * - "Software Engineer - Acme Corp | LinkedIn"
 * - "Software Engineer at Acme Corp"
 * - "Acme Corp is hiring: Software Engineer"
 * - "Software Engineer, Acme Corp - Wellfound"
 */
function parseSearchTitle(
  title: string,
  snippet: string,
): { company: string; role: string } {
  // Clean trailing site names
  const cleaned = title
    .replace(/\s*\|\s*(LinkedIn|Wellfound|AngelList|Instahyre|Cutshort).*$/i, "")
    .replace(/\s*-\s*(LinkedIn|Wellfound|AngelList|Instahyre|Cutshort).*$/i, "")
    .trim();

  let company = "";
  let role = "";

  // Pattern: "Role - Company" or "Role at Company"
  let match = cleaned.match(/^(.+?)\s+(?:-|at|@)\s+(.+)$/i);
  if (match) {
    role = match[1].trim();
    company = match[2].trim();
  }

  // Pattern: "Company is hiring: Role"
  if (!company) {
    match = cleaned.match(/^(.+?)\s+is hiring:?\s+(.+)$/i);
    if (match) {
      company = match[1].trim();
      role = match[2].trim();
    }
  }

  // Pattern: "Role, Company"
  if (!company) {
    match = cleaned.match(/^(.+?),\s+(.+)$/);
    if (match) {
      role = match[1].trim();
      company = match[2].trim();
    }
  }

  // Fallback: try snippet for "at Company" pattern
  if (!company) {
    const snippetMatch = snippet.match(/at\s+([A-Z][a-zA-Z0-9\s&.]+)/);
    if (snippetMatch) {
      role = cleaned;
      company = snippetMatch[1].trim();
    }
  }

  // Validate company name before returning
  if (!isValidCompanyName(company)) {
    return { company: "", role: "" };
  }

  return { company, role: role || cleaned };
}
