import type { SourceAdapter, SourceQuery } from "./types.js";
import type { DiscoveredJob } from "../types.js";
import { searxngSiteSearch } from "./searxng-helper.js";

export const linkedinSource: SourceAdapter = {
  id: "linkedin",
  name: "LinkedIn",
  async search(query: SourceQuery): Promise<DiscoveredJob[]> {
    console.log("[linkedin] Searching via SearXNG...");
    const jobs = await searxngSiteSearch(
      "linkedin.com/jobs",
      query,
      "linkedin",
      20,
    );
    console.log(`[linkedin] Found ${jobs.length} jobs`);
    return jobs;
  },
};
