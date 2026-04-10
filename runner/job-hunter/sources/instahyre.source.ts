import type { SourceAdapter, SourceQuery } from "./types.js";
import type { DiscoveredJob } from "../types.js";
import { searxngSiteSearch } from "./searxng-helper.js";

export const instahyreSource: SourceAdapter = {
  id: "instahyre",
  name: "Instahyre",
  async search(query: SourceQuery): Promise<DiscoveredJob[]> {
    console.log("[instahyre] Searching via SearXNG...");
    const jobs = await searxngSiteSearch(
      "instahyre.com",
      query,
      "other",
      15,
    );
    console.log(`[instahyre] Found ${jobs.length} jobs`);
    return jobs;
  },
};
