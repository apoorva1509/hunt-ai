import type { SourceAdapter, SourceQuery } from "./types.js";
import type { DiscoveredJob } from "../types.js";
import { searxngSiteSearch } from "./searxng-helper.js";

export const cutshortSource: SourceAdapter = {
  id: "cutshort",
  name: "Cutshort",
  async search(query: SourceQuery): Promise<DiscoveredJob[]> {
    console.log("[cutshort] Searching via SearXNG...");
    const jobs = await searxngSiteSearch(
      "cutshort.io",
      query,
      "other",
      15,
    );
    console.log(`[cutshort] Found ${jobs.length} jobs`);
    return jobs;
  },
};
