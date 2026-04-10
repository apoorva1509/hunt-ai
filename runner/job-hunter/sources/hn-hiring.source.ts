/**
 * Hacker News "Who's Hiring" — monthly thread via Algolia HN API.
 * Fetches latest thread, parses comments for job listings.
 */

import type { SourceAdapter, SourceQuery } from "./types.js";
import type { DiscoveredJob } from "../types.js";

const TIMEOUT = 15000;
const ALGOLIA_SEARCH = "https://hn.algolia.com/api/v1/search";
const ALGOLIA_ITEMS = "https://hn.algolia.com/api/v1/items";

export const hnHiringSource: SourceAdapter = {
  id: "hn_hiring",
  name: "HN Who's Hiring",
  async search(query: SourceQuery): Promise<DiscoveredJob[]> {
    console.log("[hn_hiring] Finding latest Who's Hiring thread...");

    try {
      // Find latest "Who is Hiring" thread
      const searchUrl = `${ALGOLIA_SEARCH}?query="who is hiring"&tags=story&hitsPerPage=5`;
      const searchRes = await fetch(searchUrl, {
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (!searchRes.ok) return [];

      const searchData = await searchRes.json();
      const thread = searchData.hits?.find((h: any) =>
        /ask hn: who is hiring/i.test(h.title),
      );
      if (!thread) {
        console.warn("[hn_hiring] No recent Who's Hiring thread found");
        return [];
      }

      console.log(`[hn_hiring] Found thread: ${thread.title} (${thread.objectID})`);

      // Fetch thread comments
      const itemRes = await fetch(`${ALGOLIA_ITEMS}/${thread.objectID}`, {
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (!itemRes.ok) return [];

      const itemData = await itemRes.json();
      const comments: any[] = itemData.children ?? [];

      const locationLower = query.location.toLowerCase();
      const locationAliases = getLocationAliases(locationLower, query.remote);
      const jobs: DiscoveredJob[] = [];

      for (const comment of comments) {
        if (!comment.text) continue;
        const text = stripHtml(comment.text);

        // Check if comment mentions the target location
        const textLower = text.toLowerCase();
        const mentionsLocation =
          locationAliases.some((alias) => textLower.includes(alias));
        if (!mentionsLocation) continue;

        const parsed = parseHNComment(text, comment.id);
        if (parsed) jobs.push(parsed);
      }

      console.log(`[hn_hiring] Found ${jobs.length} relevant jobs from ${comments.length} comments`);
      return jobs;
    } catch (err) {
      console.warn("[hn_hiring] Failed:", (err as Error).message);
      return [];
    }
  },
};

function getLocationAliases(location: string, remote: boolean): string[] {
  const aliases: string[] = [location];
  if (location.includes("bangalore") || location.includes("bengaluru")) {
    aliases.push("bangalore", "bengaluru");
  } else if (location.includes("san francisco") || location.includes("sf")) {
    aliases.push("san francisco", "sf", "bay area");
  }
  // Only match "remote" if the config explicitly wants remote jobs
  if (remote) {
    aliases.push("remote");
  }
  return aliases;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseHNComment(
  text: string,
  commentId: number,
): DiscoveredJob | null {
  // First line is typically "Company Name | Role | Location | ..."
  const firstLine = text.split(/\n/)[0].trim();
  const parts = firstLine.split("|").map((p) => p.trim());

  if (parts.length < 2) return null;

  const company = parts[0];
  // Find the part that looks most like a role title
  const role =
    parts.find(
      (p) =>
        /engineer|developer|designer|manager|lead|director|architect|scientist/i.test(p),
    ) ?? parts[1];

  if (!company || !role) return null;

  // Extract URL if present
  const urlMatch = text.match(/https?:\/\/[^\s)]+/);
  const url =
    urlMatch?.[0] ?? `https://news.ycombinator.com/item?id=${commentId}`;

  return {
    company,
    role,
    url,
    jobBoard: "other",
    snippet: text.slice(0, 300),
  };
}
