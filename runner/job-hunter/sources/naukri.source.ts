/**
 * Naukri — India's largest job board.
 * Uses their search URL which returns server-rendered HTML with JSON-LD structured data.
 */

import type { SourceAdapter, SourceQuery } from "./types.js";
import type { DiscoveredJob } from "../types.js";
import { isValidCompanyName } from "./searxng-helper.js";

const TIMEOUT = 15000;

export const naukriSource: SourceAdapter = {
  id: "naukri",
  name: "Naukri",
  async search(query: SourceQuery): Promise<DiscoveredJob[]> {
    console.log("[naukri] Searching...");
    const allJobs: DiscoveredJob[] = [];
    const seen = new Set<string>();

    for (const keyword of query.keywords.slice(0, 5)) {
      const slug = keyword.toLowerCase().replace(/\s+/g, "-");
      const locationSlug = query.location.toLowerCase().replace(/\s+/g, "-");
      const url = `https://www.naukri.com/${slug}-jobs-in-${locationSlug}`;

      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(TIMEOUT),
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            Accept: "text/html",
          },
        });
        if (!res.ok) continue;

        const html = await res.text();
        const jobs = parseNaukriHTML(html);

        for (const job of jobs) {
          if (!isValidCompanyName(job.company)) continue;
          const key = `${job.company}|${job.role}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          allJobs.push(job);
        }
      } catch {
        // Individual keyword failure is non-blocking
      }
    }

    console.log(`[naukri] Found ${allJobs.length} jobs`);
    return allJobs;
  },
};

function parseNaukriHTML(html: string): DiscoveredJob[] {
  const jobs: DiscoveredJob[] = [];

  // Try JSON-LD first (most reliable)
  const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let jsonLdMatch;
  while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(jsonLdMatch[1]);
      if (data["@type"] === "JobPosting") {
        jobs.push({
          company: typeof data.hiringOrganization === "object"
            ? data.hiringOrganization.name
            : String(data.hiringOrganization ?? ""),
          role: data.title ?? "",
          url: data.url ?? "",
          jobBoard: "other",
          snippet: (data.description ?? "").slice(0, 200),
        });
      }
      // ItemList of JobPostings
      if (data["@type"] === "ItemList" && Array.isArray(data.itemListElement)) {
        for (const item of data.itemListElement) {
          const posting = item.item ?? item;
          if (posting["@type"] !== "JobPosting") continue;
          jobs.push({
            company: typeof posting.hiringOrganization === "object"
              ? posting.hiringOrganization.name
              : String(posting.hiringOrganization ?? ""),
            role: posting.title ?? "",
            url: posting.url ?? "",
            jobBoard: "other",
            snippet: (posting.description ?? "").slice(0, 200),
          });
        }
      }
    } catch {
      // Malformed JSON-LD, skip
    }
  }

  if (jobs.length > 0) return jobs;

  // Fallback: parse job cards from HTML
  const cardRegex = /<article[^>]*class="[^"]*jobTuple[^"]*"[\s\S]*?<\/article>/gi;
  let cardMatch;
  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const card = cardMatch[0];
    const titleMatch = card.match(/<a[^>]*class="[^"]*title[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    const companyMatch = card.match(/<a[^>]*class="[^"]*subTitle[^"]*"[^>]*>([\s\S]*?)<\/a>/i);

    if (titleMatch && companyMatch) {
      jobs.push({
        company: companyMatch[1].replace(/<[^>]+>/g, "").trim(),
        role: titleMatch[2].replace(/<[^>]+>/g, "").trim(),
        url: titleMatch[1].startsWith("http")
          ? titleMatch[1]
          : `https://www.naukri.com${titleMatch[1]}`,
        jobBoard: "other",
      });
    }
  }

  return jobs;
}
