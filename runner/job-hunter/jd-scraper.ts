import type { DiscoveredJob } from "./types.js";

const LIVENESS_TIMEOUT = 5000;
const MAX_JD_LENGTH = 8000;

/**
 * Check if a job URL is still live.
 */
export async function checkLiveness(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIVENESS_TIMEOUT);

    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (res.status === 404 || res.status === 410) return false;

    // 405 = HEAD not allowed, try GET with Range
    if (res.status === 405) {
      const getRes = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-1024" },
        signal: AbortSignal.timeout(LIVENESS_TIMEOUT),
      });
      return getRes.status !== 404 && getRes.status !== 410;
    }

    return true;
  } catch {
    // Network error = assume live (don't skip on flaky network)
    return true;
  }
}

/**
 * Scrape full JD text from a job URL using board-specific APIs.
 */
export async function scrapeJD(job: DiscoveredJob): Promise<string | null> {
  try {
    // Detect ATS type from URL regardless of jobBoard value
    if (job.url.includes("greenhouse.io")) {
      return await scrapeGreenhouse(job.url);
    }
    if (job.url.includes("lever.co")) {
      return await scrapeLever(job.url);
    }
    return await scrapeGeneric(job.url);
  } catch (err) {
    console.warn(`[jd-scraper] Failed to scrape ${job.url}:`, (err as Error).message);
    return null;
  }
}

async function scrapeGreenhouse(url: string): Promise<string | null> {
  // Extract company and job ID from URL
  // Pattern: boards.greenhouse.io/company/jobs/12345 or job-boards.greenhouse.io
  const match = url.match(
    /(?:boards|job-boards)\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/
  );
  if (!match) return scrapeGeneric(url);

  const [, company, jobId] = match;
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs/${jobId}`;

  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return scrapeGeneric(url);

  const data = await res.json();
  const content = data.content ?? "";
  return stripHtml(content).slice(0, MAX_JD_LENGTH);
}

async function scrapeLever(url: string): Promise<string | null> {
  // Pattern: jobs.lever.co/company/uuid
  const match = url.match(/jobs\.lever\.co\/([^/]+)\/([a-f0-9-]+)/);
  if (!match) return scrapeGeneric(url);

  const [, company, postingId] = match;
  const apiUrl = `https://api.lever.co/v0/postings/${company}/${postingId}`;

  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return scrapeGeneric(url);

  const data = await res.json();
  const parts: string[] = [];

  if (data.descriptionPlain) parts.push(data.descriptionPlain);
  if (data.lists) {
    for (const list of data.lists) {
      if (list.text) parts.push(list.text);
      if (list.content) parts.push(stripHtml(list.content));
    }
  }
  if (data.additional) parts.push(stripHtml(data.additional));

  return parts.join("\n\n").slice(0, MAX_JD_LENGTH);
}

async function scrapeGeneric(url: string): Promise<string | null> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  if (!res.ok) return null;

  const html = await res.text();
  return stripHtml(html).slice(0, MAX_JD_LENGTH);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
