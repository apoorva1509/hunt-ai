/**
 * YC Work at a Startup — direct fetch, parses Inertia.js data-page JSON.
 */

import type { SourceAdapter, SourceQuery } from "./types.js";
import type { DiscoveredJob } from "../types.js";

const TIMEOUT = 15000;

interface YCJob {
  id: number;
  title: string;
  jobType: string;
  location: string;
  roleType: string;
  companyName: string;
  companySlug: string;
  companyBatch: string;
  companyOneLiner: string;
  companyLogoUrl: string;
  companyLastActiveAt: string;
  applyUrl?: string;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

export const ycWatsSource: SourceAdapter = {
  id: "yc_wats",
  name: "YC Work at a Startup",
  async search(query: SourceQuery): Promise<DiscoveredJob[]> {
    const location = query.location || "Bengaluru";
    const url = `https://www.workatastartup.com/jobs?location=${encodeURIComponent(location)}`;
    console.log(`[yc_wats] Fetching jobs in ${location}...`);

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });
      if (!res.ok) return [];

      const html = await res.text();
      const dataPageMatch = html.match(/data-page="([^"]*)"/);
      if (!dataPageMatch) {
        console.warn("[yc_wats] No data-page attribute found");
        return [];
      }

      const decoded = decodeHtmlEntities(dataPageMatch[1]);
      const pageData = JSON.parse(decoded);
      const jobs: YCJob[] = pageData?.props?.jobs ?? [];

      if (!Array.isArray(jobs)) return [];

      const results = jobs.map((j) => ({
        company: j.companyName,
        role: j.title,
        url:
          j.applyUrl ||
          `https://www.workatastartup.com/companies/${j.companySlug}`,
        jobBoard: "other" as const,
        snippet: `${j.companyOneLiner ?? ""} (YC ${j.companyBatch ?? "unknown"})`.trim(),
      }));

      console.log(`[yc_wats] Found ${results.length} jobs`);
      return results;
    } catch (err) {
      console.warn("[yc_wats] Scrape failed:", (err as Error).message);
      return [];
    }
  },
};
