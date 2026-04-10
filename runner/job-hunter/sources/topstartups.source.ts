/**
 * TopStartups.io — aggregator for funded startup jobs.
 * Fetches public job listings via their search page.
 */

import type { SourceAdapter, SourceQuery } from "./types.js";
import type { DiscoveredJob } from "../types.js";

const TIMEOUT = 15000;
const BASE_URL = "https://topstartups.io";

export const topstartupsSource: SourceAdapter = {
  id: "topstartups",
  name: "TopStartups.io",
  async search(query: SourceQuery): Promise<DiscoveredJob[]> {
    console.log("[topstartups] Searching...");

    try {
      // TopStartups has a jobs page with filters
      const locationParam = encodeURIComponent(query.location);
      const url = `${BASE_URL}/startup-jobs/?location=${locationParam}&role=Engineering`;

      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "text/html",
        },
      });
      if (!res.ok) return [];

      const html = await res.text();
      const jobs = parseTopStartupsHTML(html);

      console.log(`[topstartups] Found ${jobs.length} jobs`);
      return jobs;
    } catch (err) {
      console.warn("[topstartups] Failed:", (err as Error).message);
      return [];
    }
  },
};

function parseTopStartupsHTML(html: string): DiscoveredJob[] {
  const jobs: DiscoveredJob[] = [];
  const seen = new Set<string>();

  // Try JSON-LD first
  const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let jsonLdMatch;
  while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(jsonLdMatch[1]);
      if (data["@type"] === "JobPosting") {
        const key = `${data.title}|${data.hiringOrganization?.name}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        jobs.push({
          company: data.hiringOrganization?.name ?? "",
          role: data.title ?? "",
          url: data.url ?? "",
          jobBoard: "other",
          snippet: (data.description ?? "").slice(0, 200),
        });
      }
    } catch {}
  }

  if (jobs.length > 0) return jobs;

  // Fallback: parse job card links
  // Pattern: <a href="/startup-jobs/..." class="...">Role</a> with nearby company name
  const jobLinkRegex =
    /<a[^>]+href="(\/startup-jobs\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let linkMatch;
  while ((linkMatch = jobLinkRegex.exec(html)) !== null) {
    const href = linkMatch[1];
    const text = linkMatch[2].replace(/<[^>]+>/g, "").trim();
    if (!text || text.length < 5) continue;

    const key = `${href}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Try to extract company from URL slug: /startup-jobs/company-name/role-title
    const slugParts = href.split("/").filter(Boolean);
    const company = slugParts[1]
      ?.replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) ?? "";

    jobs.push({
      company,
      role: text,
      url: `${BASE_URL}${href}`,
      jobBoard: "other",
    });
  }

  return jobs;
}
