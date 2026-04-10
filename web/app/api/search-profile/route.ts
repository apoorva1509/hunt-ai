import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "..");
const PROFILES_DIR = path.join(ROOT, "config", "search-profiles");
const ACTIVE_FILE = path.join(ROOT, "config", "active-search-profile.json");

const ALL_SOURCES = [
  "linkedin", "yc_wats", "wellfound", "naukri",
  "instahyre", "cutshort", "hn_hiring", "topstartups",
] as const;

type SourceId = (typeof ALL_SOURCES)[number];

function getActiveSlug(): string {
  if (fs.existsSync(ACTIVE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(ACTIVE_FILE, "utf-8")).active;
    } catch {}
  }
  return "";
}

// ── YAML parser ──────────────────────────────────────────────

interface ParsedProfile {
  location: string;
  remote: boolean;
  titleFilter: { positive: string[]; negative: string[] };
  sources: SourceId[];
  companyFilter: { max_size?: number; funding?: string; exclude_mncs?: boolean };
  pipelineSettings: { filter_by_score: boolean; min_score: number };
}

function parseProfileYaml(text: string): ParsedProfile {
  const result: ParsedProfile = {
    location: "",
    remote: false,
    titleFilter: { positive: [], negative: [] },
    sources: [],
    companyFilter: {},
    pipelineSettings: { filter_by_score: false, min_score: 60 },
  };

  let section = "";
  let filterSection = "";

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;

    const locMatch = line.match(/^location:\s*(.+)$/);
    if (locMatch) { result.location = locMatch[1].replace(/^['"]|['"]$/g, "").trim(); continue; }

    const remoteMatch = line.match(/^remote:\s*(.+)$/);
    if (remoteMatch) { result.remote = remoteMatch[1].trim() === "true"; continue; }

    if (line === "title_filter:") { section = "title_filter"; filterSection = ""; continue; }
    if (line === "sources:") { section = "sources"; continue; }
    if (line === "company_filter:") { section = "company_filter"; continue; }
    if (line === "pipeline_settings:") { section = "pipeline_settings"; continue; }

    if (section === "title_filter") {
      if (/^\s+positive:/.test(line)) { filterSection = "positive"; continue; }
      if (/^\s+negative:/.test(line)) { filterSection = "negative"; continue; }
      if (/^\s+seniority_boost:/.test(line)) { filterSection = "seniority_boost"; continue; }
      const itemMatch = line.match(/^\s+-\s+"?([^"]+)"?\s*$/);
      if (itemMatch && filterSection) {
        if (filterSection === "positive") result.titleFilter.positive.push(itemMatch[1]);
        else if (filterSection === "negative") result.titleFilter.negative.push(itemMatch[1]);
      }
    }

    if (section === "sources") {
      const srcMatch = line.match(/^\s+-\s+(\S+)\s*$/);
      if (srcMatch && ALL_SOURCES.includes(srcMatch[1] as SourceId)) {
        result.sources.push(srcMatch[1] as SourceId);
      }
    }

    if (section === "company_filter") {
      const kvMatch = line.match(/^\s+(\w+):\s*(.+)$/);
      if (kvMatch) {
        const [, key, val] = kvMatch;
        const clean = val.replace(/^['"]|['"]$/g, "").trim();
        if (key === "max_size") result.companyFilter.max_size = parseInt(clean, 10);
        else if (key === "funding") result.companyFilter.funding = clean;
        else if (key === "exclude_mncs") result.companyFilter.exclude_mncs = clean === "true";
      }
    }

    if (section === "pipeline_settings") {
      const kvMatch = line.match(/^\s+(\w+):\s*(.+)$/);
      if (kvMatch) {
        const [, key, val] = kvMatch;
        const clean = val.replace(/^['"]|['"]$/g, "").trim();
        if (key === "filter_by_score") result.pipelineSettings.filter_by_score = clean === "true";
        else if (key === "min_score") result.pipelineSettings.min_score = parseInt(clean, 10);
      }
    }
  }

  return result;
}

// ── YAML mutation helpers ────────────────────────────────────

function addKeywordToYaml(content: string, type: "positive" | "negative", keyword: string): string {
  const sectionHeader = `  ${type}:`;
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimEnd() === sectionHeader) {
      let lastItemIdx = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^\s+-\s+/.test(lines[j])) lastItemIdx = j;
        else break;
      }
      lines.splice(lastItemIdx + 1, 0, `    - "${keyword}"`);
      return lines.join("\n");
    }
  }
  return content;
}

function removeKeywordFromYaml(content: string, type: "positive" | "negative", keyword: string): string {
  const lines = content.split("\n");
  const escapedKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^\\s+-\\s+"?${escapedKw}"?\\s*$`);
  let inSection = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimEnd() === `  ${type}:`) { inSection = true; continue; }
    if (inSection && /^\s+\w+:/.test(lines[i]) && !/^\s+-/.test(lines[i])) { inSection = false; }
    if (inSection && pattern.test(lines[i])) {
      lines.splice(i, 1);
      return lines.join("\n");
    }
  }
  return content;
}

function toggleSourceInYaml(content: string, source: SourceId, enabled: boolean): string {
  const lines = content.split("\n");
  const sourcePattern = new RegExp(`^\\s+-\\s+${source}\\s*$`);

  if (enabled) {
    // Add source to the sources list
    let sourcesIdx = -1;
    let lastSourceLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trimEnd() === "sources:") { sourcesIdx = i; continue; }
      if (sourcesIdx >= 0 && /^\s+-\s+/.test(lines[i])) lastSourceLine = i;
      if (sourcesIdx >= 0 && lastSourceLine >= 0 && !/^\s+-/.test(lines[i]) && lines[i].trim()) break;
    }
    if (lastSourceLine >= 0) {
      lines.splice(lastSourceLine + 1, 0, `  - ${source}`);
    } else if (sourcesIdx >= 0) {
      lines.splice(sourcesIdx + 1, 0, `  - ${source}`);
    }
    return lines.join("\n");
  } else {
    // Remove source from the list
    for (let i = 0; i < lines.length; i++) {
      if (sourcePattern.test(lines[i])) {
        lines.splice(i, 1);
        return lines.join("\n");
      }
    }
    return content;
  }
}

function setLocationInYaml(content: string, location: string): string {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/^location:/.test(lines[i])) {
      lines[i] = `location: ${location}`;
      return lines.join("\n");
    }
  }
  // Add after first comment block
  const insertIdx = lines.findIndex((l) => l.trim() && !l.startsWith("#"));
  lines.splice(insertIdx >= 0 ? insertIdx : 0, 0, `location: ${location}`);
  return lines.join("\n");
}

function setRemoteInYaml(content: string, remote: boolean): string {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/^remote:/.test(lines[i])) {
      lines[i] = `remote: ${remote}`;
      return lines.join("\n");
    }
  }
  // Add after location
  for (let i = 0; i < lines.length; i++) {
    if (/^location:/.test(lines[i])) {
      lines.splice(i + 1, 0, `remote: ${remote}`);
      return lines.join("\n");
    }
  }
  return `remote: ${remote}\n${content}`;
}

function setPipelineSettingInYaml(content: string, key: string, value: string | number | boolean): string {
  const lines = content.split("\n");
  let inSection = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimEnd() === "pipeline_settings:") { inSection = true; continue; }
    if (inSection && /^\w/.test(lines[i]) && lines[i].trim()) { inSection = false; }
    if (inSection) {
      const kvMatch = lines[i].match(/^(\s+)(filter_by_score|min_score):\s*.+$/);
      if (kvMatch && kvMatch[2] === key) {
        lines[i] = `${kvMatch[1]}${key}: ${value}`;
        return lines.join("\n");
      }
    }
  }
  // Section doesn't exist yet — append it
  const sectionIdx = lines.findIndex((l) => l.trimEnd() === "pipeline_settings:");
  if (sectionIdx === -1) {
    lines.push("", "pipeline_settings:", `  ${key}: ${value}`);
  } else {
    // Section exists but key doesn't — add it after the header
    lines.splice(sectionIdx + 1, 0, `  ${key}: ${value}`);
  }
  return lines.join("\n");
}

// ── Routes ───────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (slug) {
    const filePath = path.join(PROFILES_DIR, `${slug}.yml`);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: `Profile "${slug}" not found` }, { status: 404 });
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = parseProfileYaml(content);
    return NextResponse.json({
      slug,
      active: slug === getActiveSlug(),
      ...parsed,
      rawContent: content,
    });
  }

  if (!fs.existsSync(PROFILES_DIR)) return NextResponse.json({ active: null, profiles: [] });

  const activeSlug = getActiveSlug();
  const profiles = fs
    .readdirSync(PROFILES_DIR)
    .filter((f) => f.endsWith(".yml"))
    .map((f) => {
      const s = f.replace(/\.yml$/, "");
      const content = fs.readFileSync(path.join(PROFILES_DIR, f), "utf-8");
      const parsed = parseProfileYaml(content);
      return {
        slug: s,
        active: s === activeSlug,
        location: parsed.location,
        remote: parsed.remote,
        enabledSources: parsed.sources.length,
        totalSources: ALL_SOURCES.length,
        sources: parsed.sources,
        keywordCount: parsed.titleFilter.positive.length,
        companyFilter: parsed.companyFilter,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

  return NextResponse.json({ active: activeSlug || null, profiles });
}

export async function PUT(request: Request) {
  const body = await request.json();

  if (body.active && !body.slug) {
    const filePath = path.join(PROFILES_DIR, `${body.active}.yml`);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: `Profile "${body.active}" not found` }, { status: 404 });
    }
    fs.writeFileSync(ACTIVE_FILE, JSON.stringify({ active: body.active }, null, 2) + "\n");
    return NextResponse.json({ active: body.active });
  }

  if (body.slug && body.content !== undefined) {
    const filePath = path.join(PROFILES_DIR, `${body.slug}.yml`);
    if (!fs.existsSync(filePath)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    fs.writeFileSync(filePath, body.content, "utf-8");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { slug, action } = body;

  if (!slug || !action) {
    return NextResponse.json({ error: "Missing slug or action" }, { status: 400 });
  }

  const filePath = path.join(PROFILES_DIR, `${slug}.yml`);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let content = fs.readFileSync(filePath, "utf-8");

  switch (action) {
    case "addKeyword":
      content = addKeywordToYaml(content, body.type, body.keyword);
      break;
    case "removeKeyword":
      content = removeKeywordFromYaml(content, body.type, body.keyword);
      break;
    case "toggleSource":
      content = toggleSourceInYaml(content, body.source, body.enabled);
      break;
    case "setLocation":
      content = setLocationInYaml(content, body.location);
      break;
    case "setRemote":
      content = setRemoteInYaml(content, body.remote);
      break;
    case "setFilterByScore":
      content = setPipelineSettingInYaml(content, "filter_by_score", body.enabled);
      break;
    case "setMinScore":
      content = setPipelineSettingInYaml(content, "min_score", body.minScore);
      break;
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  fs.writeFileSync(filePath, content, "utf-8");
  const parsed = parseProfileYaml(content);
  return NextResponse.json({ ok: true, ...parsed });
}

export async function POST(request: Request) {
  const { slug, content, copyFrom } = await request.json();

  if (!slug || typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Slug must be lowercase alphanumeric with hyphens" }, { status: 400 });
  }

  if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR, { recursive: true });

  const filePath = path.join(PROFILES_DIR, `${slug}.yml`);
  if (fs.existsSync(filePath)) {
    return NextResponse.json({ error: `Profile "${slug}" already exists` }, { status: 409 });
  }

  let finalContent = content;
  if (!finalContent && copyFrom) {
    const srcPath = path.join(PROFILES_DIR, `${copyFrom}.yml`);
    if (fs.existsSync(srcPath)) finalContent = fs.readFileSync(srcPath, "utf-8");
  }
  if (!finalContent) {
    finalContent = `# Search Profile: ${slug}\n# Created ${new Date().toISOString().slice(0, 10)}\n\nlocation: Bangalore\nremote: false\n\ntitle_filter:\n  positive:\n    - "Software Engineer"\n  negative:\n    - "Junior"\n    - "Intern"\n\nsources:\n  - linkedin\n  - yc_wats\n  - wellfound\n  - naukri\n  - instahyre\n  - cutshort\n  - hn_hiring\n  - topstartups\n\ncompany_filter:\n  exclude_mncs: false\n`;
  }

  fs.writeFileSync(filePath, finalContent, "utf-8");
  return NextResponse.json({ slug }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { slug } = await request.json();
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  if (slug === getActiveSlug()) {
    return NextResponse.json({ error: "Cannot delete the active profile. Switch first." }, { status: 400 });
  }
  const filePath = path.join(PROFILES_DIR, `${slug}.yml`);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  fs.unlinkSync(filePath);
  return NextResponse.json({ deleted: slug });
}
