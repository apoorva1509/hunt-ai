import type { SearchResult } from "./types.js";

const SEARXNG_URL = process.env.SEARXNG_URL ?? "http://localhost:8888";

const CONCURRENCY = 6;
const BATCH_DELAY = 500;
const MAX_RETRIES = 3;

let verified = false;

async function ensureSearxng(): Promise<void> {
  if (verified) return;

  console.log("[search] Verifying SearXNG at", SEARXNG_URL);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${SEARXNG_URL}/search?q=test&format=json`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      throw new Error(`SearXNG returned status ${res.status}`);
    }
    verified = true;
    console.log("[search] SearXNG ready at", SEARXNG_URL);
  } catch (err) {
    clearTimeout(timeout);
    throw new Error(
      `SearXNG not available at ${SEARXNG_URL}: ${(err as Error).message}. ` +
        `Start it with: docker run -d -p 8888:8080 searxng/searxng`
    );
  }
}

async function searchSearxng(
  query: string,
  num: number
): Promise<SearchResult[]> {
  const url = new URL(`${SEARXNG_URL}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`SearXNG ${res.status}`);

  const data = await res.json();
  return (data.results ?? []).slice(0, num).map((r: any) => ({
    title: r.title ?? "",
    link: r.url ?? r.link ?? "",
    snippet: r.content ?? "",
    date: r.publishedDate ?? undefined,
  }));
}

async function searchWithRetry(
  query: string,
  num: number
): Promise<SearchResult[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await searchSearxng(query, num);
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_RETRIES - 1) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        await sleep(delay);
      }
    }
  }

  console.warn(`[search] Failed after ${MAX_RETRIES} retries: ${query}`, lastError?.message);
  return [];
}

/**
 * Execute multiple search queries in batches with concurrency control.
 */
export async function batchSearch(
  queries: Array<{ query: string; num?: number }>
): Promise<Map<string, SearchResult[]>> {
  await ensureSearxng();

  const results = new Map<string, SearchResult[]>();

  for (let i = 0; i < queries.length; i += CONCURRENCY) {
    const batch = queries.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((q) => searchWithRetry(q.query, q.num ?? 10))
    );
    for (let j = 0; j < batch.length; j++) {
      results.set(batch[j].query, batchResults[j]);
    }
    if (i + CONCURRENCY < queries.length) {
      await sleep(BATCH_DELAY);
    }
  }

  return results;
}

/**
 * Single search query.
 */
export async function search(
  query: string,
  num = 10
): Promise<SearchResult[]> {
  await ensureSearxng();
  return searchWithRetry(query, num);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Deduplicate search results by URL.
 */
export function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.link.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
