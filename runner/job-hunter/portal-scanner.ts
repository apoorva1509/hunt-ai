/**
 * Source-based Job Discovery Scanner
 *
 * Queries 8 job portals/sources with keywords + location to discover jobs.
 * No fixed company list — discovers companies from search results.
 *
 * Sources (in priority order):
 * 1. LinkedIn (via SearXNG)
 * 2. YC Work at a Startup (direct fetch)
 * 3. Wellfound (via SearXNG)
 * 4. Naukri (direct HTML scrape)
 * 5. Instahyre (via SearXNG)
 * 6. Cutshort (via SearXNG)
 * 7. HN Who's Hiring (Algolia API)
 * 8. TopStartups.io (direct fetch)
 */

import fs from "fs";
import path from "path";
import type { DiscoveredJob } from "./types.js";
import { getAdapter } from "./sources/index.js";
import type { SourceId, SourceQuery } from "./sources/types.js";
import { ALL_SOURCES } from "./sources/types.js";

interface TitleFilter {
  positive: string[];
  negative: string[];
}

interface CompanyFilter {
  max_size?: number;
  funding?: string;
  exclude_mncs?: boolean;
}

interface PipelineSettings {
  filter_by_score: boolean;
  min_score: number;
}

interface SourceConfig {
  location: string;
  remote: boolean;
  titleFilter: TitleFilter;
  sources: SourceId[];
  companyFilter: CompanyFilter;
  pipelineSettings: PipelineSettings;
}

// ── YAML-lite parser for source-based config ────────────────

function parseSourceConfigYaml(text: string): SourceConfig {
  const config: SourceConfig = {
    location: "Bangalore",
    remote: false,
    titleFilter: { positive: [], negative: [] },
    sources: [...ALL_SOURCES],
    companyFilter: {},
    pipelineSettings: { filter_by_score: false, min_score: 60 },
  };

  let section = "";
  let filterSection = "";

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;

    // Top-level keys
    const locMatch = line.match(/^location:\s*(.+)$/);
    if (locMatch) { config.location = locMatch[1].replace(/^['"]|['"]$/g, "").trim(); continue; }

    const remoteMatch = line.match(/^remote:\s*(.+)$/);
    if (remoteMatch) { config.remote = remoteMatch[1].trim() === "true"; continue; }

    // Sections
    if (line === "title_filter:") { section = "title_filter"; filterSection = ""; continue; }
    if (line === "sources:") { section = "sources"; config.sources = []; continue; }
    if (line === "company_filter:") { section = "company_filter"; continue; }
    if (line === "pipeline_settings:") { section = "pipeline_settings"; continue; }

    if (section === "title_filter") {
      if (/^\s+positive:/.test(line)) { filterSection = "positive"; continue; }
      if (/^\s+negative:/.test(line)) { filterSection = "negative"; continue; }
      if (/^\s+seniority_boost:/.test(line)) { filterSection = "seniority_boost"; continue; }
      const itemMatch = line.match(/^\s+-\s+"?([^"]+)"?\s*$/);
      if (itemMatch && filterSection) {
        if (filterSection === "positive") config.titleFilter.positive.push(itemMatch[1]);
        else if (filterSection === "negative") config.titleFilter.negative.push(itemMatch[1]);
      }
    }

    if (section === "sources") {
      const srcMatch = line.match(/^\s+-\s+(\S+)\s*$/);
      if (srcMatch && ALL_SOURCES.includes(srcMatch[1] as SourceId)) {
        config.sources.push(srcMatch[1] as SourceId);
      }
    }

    if (section === "company_filter") {
      const kvMatch = line.match(/^\s+(\w+):\s*(.+)$/);
      if (kvMatch) {
        const [, key, val] = kvMatch;
        const clean = val.replace(/^['"]|['"]$/g, "").trim();
        if (key === "max_size") config.companyFilter.max_size = parseInt(clean, 10);
        else if (key === "funding") config.companyFilter.funding = clean;
        else if (key === "exclude_mncs") config.companyFilter.exclude_mncs = clean === "true";
      }
    }

    if (section === "pipeline_settings") {
      const kvMatch = line.match(/^\s+(\w+):\s*(.+)$/);
      if (kvMatch) {
        const [, key, val] = kvMatch;
        const clean = val.replace(/^['"]|['"]$/g, "").trim();
        if (key === "filter_by_score") config.pipelineSettings.filter_by_score = clean === "true";
        else if (key === "min_score") config.pipelineSettings.min_score = parseInt(clean, 10);
      }
    }
  }

  return config;
}

// ── Title Filter ────────────────────────────────────────────

function matchesTitleFilter(title: string, filter: TitleFilter): boolean {
  const lower = title.toLowerCase();
  const hasPositive =
    filter.positive.length === 0 ||
    filter.positive.some((kw) => lower.includes(kw.toLowerCase()));
  const hasNegative = filter.negative.some((kw) =>
    lower.includes(kw.toLowerCase()),
  );
  return hasPositive && !hasNegative;
}

// ── Profile Resolution ──────────────────────────────────────

function resolveConfigPath(): string {
  const root = path.resolve(process.cwd(), "../..");

  const envProfile = process.env.SEARCH_PROFILE;
  if (envProfile) {
    const envPath = path.join(root, "config", "search-profiles", `${envProfile}.yml`);
    if (fs.existsSync(envPath)) {
      console.log(`[scanner] Using search profile from env: ${envProfile}`);
      return envPath;
    }
    console.warn(`[scanner] SEARCH_PROFILE="${envProfile}" not found, falling back`);
  }

  const activeFile = path.join(root, "config", "active-search-profile.json");
  if (fs.existsSync(activeFile)) {
    try {
      const { active } = JSON.parse(fs.readFileSync(activeFile, "utf-8"));
      const profilePath = path.join(root, "config", "search-profiles", `${active}.yml`);
      if (fs.existsSync(profilePath)) {
        console.log(`[scanner] Using search profile: ${active}`);
        return profilePath;
      }
      console.warn(`[scanner] Profile "${active}" not found, falling back`);
    } catch {}
  }

  return path.join(root, "portals.yml");
}

// ── Main Scanner ────────────────────────────────────────────

export { type PipelineSettings };

export function loadPipelineSettings(): PipelineSettings {
  const configPath = resolveConfigPath();
  if (!fs.existsSync(configPath)) return { filter_by_score: false, min_score: 60 };
  const raw = fs.readFileSync(configPath, "utf-8");
  return parseSourceConfigYaml(raw).pipelineSettings;
}

export async function scanPortals(
  targetRoles: string[],
): Promise<DiscoveredJob[]> {
  const configPath = resolveConfigPath();
  if (!fs.existsSync(configPath)) {
    console.warn("[scanner] Config not found at", configPath);
    return [];
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const config = parseSourceConfigYaml(raw);

  const query: SourceQuery = {
    keywords: [...new Set([...config.titleFilter.positive, ...targetRoles])],
    negativeKeywords: config.titleFilter.negative,
    location: config.location,
    remote: config.remote,
  };

  console.log(`[scanner] Querying ${config.sources.length} sources for "${query.location}"...`);
  console.log(`[scanner] Keywords: ${query.keywords.join(", ")}`);

  // Split sources into direct-fetch (can run fully parallel) and SearXNG-based (share rate limit)
  const directSources: SourceId[] = ["yc_wats", "naukri", "hn_hiring", "topstartups"];
  const searxngSources: SourceId[] = ["linkedin", "wellfound", "instahyre", "cutshort"];

  const enabledDirect = config.sources.filter((s) => directSources.includes(s));
  const enabledSearxng = config.sources.filter((s) => searxngSources.includes(s));

  // Run direct-fetch sources in parallel
  const directPromises = enabledDirect.map(async (id) => {
    try {
      const adapter = getAdapter(id);
      return await adapter.search(query);
    } catch (err) {
      console.warn(`[scanner] ${id} failed:`, (err as Error).message);
      return [];
    }
  });

  // Run SearXNG sources sequentially (shared rate limit)
  const searxngPromise = (async () => {
    const results: DiscoveredJob[] = [];
    for (const id of enabledSearxng) {
      try {
        const adapter = getAdapter(id);
        const jobs = await adapter.search(query);
        results.push(...jobs);
      } catch (err) {
        console.warn(`[scanner] ${id} failed:`, (err as Error).message);
      }
      // Small delay between SearXNG sources
      await new Promise((r) => setTimeout(r, 500));
    }
    return results;
  })();

  // Collect all results
  const [directResults, searxngResults] = await Promise.all([
    Promise.all(directPromises),
    searxngPromise,
  ]);

  const allJobs = [...directResults.flat(), ...searxngResults];
  console.log(`[scanner] ${allJobs.length} total jobs from all sources`);

  // Filter by title
  const filtered = allJobs.filter((j) =>
    matchesTitleFilter(j.role, config.titleFilter),
  );
  console.log(`[scanner] ${filtered.length} after title filter`);

  // Deduplicate by company+role
  const seen = new Set<string>();
  const unique: DiscoveredJob[] = [];
  for (const job of filtered) {
    const key = `${job.company.toLowerCase()}|${job.role.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(job);
  }

  console.log(`[scanner] ${unique.length} unique jobs after dedup`);
  return unique;
}
