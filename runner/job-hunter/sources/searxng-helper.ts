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

  // Pattern: "Role - Company" or "Role at Company"
  let match = cleaned.match(/^(.+?)\s+(?:-|at|@)\s+(.+)$/i);
  if (match) return { role: match[1].trim(), company: match[2].trim() };

  // Pattern: "Company is hiring: Role"
  match = cleaned.match(/^(.+?)\s+is hiring:?\s+(.+)$/i);
  if (match) return { company: match[1].trim(), role: match[2].trim() };

  // Pattern: "Role, Company"
  match = cleaned.match(/^(.+?),\s+(.+)$/);
  if (match) return { role: match[1].trim(), company: match[2].trim() };

  // Fallback: try snippet for "at Company" pattern
  const snippetMatch = snippet.match(/at\s+([A-Z][a-zA-Z0-9\s&.]+)/);
  if (snippetMatch) {
    return { role: cleaned, company: snippetMatch[1].trim() };
  }

  return { company: "", role: cleaned };
}
