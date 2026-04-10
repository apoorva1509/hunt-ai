import type { SourceAdapter, SourceQuery } from "./types.js";
import type { DiscoveredJob } from "../types.js";
import { searxngSiteSearch } from "./searxng-helper.js";

export const wellfoundSource: SourceAdapter = {
  id: "wellfound",
  name: "Wellfound",
  async search(query: SourceQuery): Promise<DiscoveredJob[]> {
    console.log("[wellfound] Searching via SearXNG...");
    const jobs = await searxngSiteSearch(
      "wellfound.com",
      query,
      "other",
      15,
    );
    console.log(`[wellfound] Found ${jobs.length} jobs`);
    return jobs;
  },
};
