#!/usr/bin/env node

/**
 * outreach-connect.mjs — Semi-automated LinkedIn outreach
 *
 * Usage:
 *   node outreach-connect.mjs --company "https://linkedin.com/company/acme" --role "Senior AI Engineer"
 *   node outreach-connect.mjs --company "https://linkedin.com/company/acme" --role "Senior AI Engineer" --max 5
 *   node outreach-connect.mjs --company "https://linkedin.com/company/acme" --role "Senior AI Engineer" --dry-run
 *
 * API keys are auto-loaded from the project's existing .env files and Convex config.
 * Requires: Playwright installed, LinkedIn session saved
 */

import { chromium } from "playwright";
import { readFileSync, existsSync, appendFileSync, mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load API keys from existing project config ──────────────

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const vars = {};
  for (const line of readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return vars;
}

function loadApiKeys() {
  // Load from runner/.env and web/.env.local
  const runnerEnv = loadEnvFile(resolve(__dirname, "runner/job-hunter/.env"));
  const webEnv = loadEnvFile(resolve(__dirname, "web/.env.local"));

  let anthropicKey = process.env.ANTHROPIC_API_KEY || runnerEnv.ANTHROPIC_API_KEY || webEnv.ANTHROPIC_API_KEY;
  let apolloKey = process.env.APOLLO_API_KEY || runnerEnv.APOLLO_API_KEY || webEnv.APOLLO_API_KEY;

  // Apollo key lives in Convex env vars — fetch if not found locally
  if (!apolloKey) {
    try {
      const output = execSync("npx convex env list 2>/dev/null", { encoding: "utf-8", timeout: 10000 });
      const match = output.match(/APOLLO_API_KEY=(.+)/);
      if (match) apolloKey = match[1].trim();
    } catch { /* Convex CLI not available */ }
  }

  return { anthropicKey, apolloKey };
}

const { anthropicKey: ANTHROPIC_API_KEY, apolloKey: APOLLO_API_KEY } = loadApiKeys();
const STATE_PATH =
  process.env.LINKEDIN_STATE_PATH ??
  `${process.env.HOME}/.suprdash/linkedin-state.json`;

const LOG_FILE = resolve(__dirname, "batch/outreach-log.tsv");

const TARGET_TITLES = [
  "Founder", "Co-founder", "Co-Founder", "Cofounder",
  "CEO", "CTO", "COO",
  "VP Engineering", "VP of Engineering", "Vice President Engineering",
  "Engineering Manager", "Head of Engineering", "Director of Engineering",
  "Founding Engineer", "Senior Engineer", "Senior Software Engineer",
  "Staff Engineer", "Principal Engineer",
  "Recruiter", "Talent Acquisition", "HR Manager", "People Operations",
  "Technical Recruiter", "Head of Talent",
];

const CONTACTO_RULES = `
Generate a LinkedIn connection request message. Rules:
- Framework: Hook (specific about their company/role) -> Proof Point (candidate's relevant achievement) -> Soft Ask (interested in role, love to connect)
- MAX 300 characters (LinkedIn limit). Aim for 250-290.
- NO corporate-speak, NO "I'm passionate about...", NO "I came across", NO "hope this finds you well"
- Make them want to respond
- NEVER share phone number
- End with no-pressure close ("No pressure either way" / "Completely understand if not")
- You:I ratio >= 2:1 (talk more about THEM than yourself)
- Use first name only, be warm but professional
`.trim();

// ── CLI Parsing ─────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { company: null, role: null, max: 10, dryRun: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--company" && args[i + 1]) parsed.company = args[++i];
    else if (args[i] === "--role" && args[i + 1]) parsed.role = args[++i];
    else if (args[i] === "--max" && args[i + 1]) parsed.max = parseInt(args[++i], 10);
    else if (args[i] === "--dry-run") parsed.dryRun = true;
  }

  if (!parsed.company || !parsed.role) {
    console.error(`
Usage: node outreach-connect.mjs --company <linkedin-url> --role <job-role> [--max N] [--dry-run]

Example:
  node outreach-connect.mjs --company "https://linkedin.com/company/stripe" --role "Senior AI Engineer"
`);
    process.exit(1);
  }

  return parsed;
}

// ── Apollo API ──────────────────────────────────────────────

async function apolloEnrichCompany(linkedinUrl) {
  // Extract slug from LinkedIn URL to guess domain
  const slugMatch = linkedinUrl.match(/\/company\/([^/?]+)/);
  if (!slugMatch) throw new Error(`Invalid LinkedIn company URL: ${linkedinUrl}`);
  const slug = slugMatch[1].toLowerCase();

  // Try domain guesses
  const domainGuesses = [`${slug}.com`, `${slug}.io`, `${slug}.ai`, `${slug}.co`];

  for (const domain of domainGuesses) {
    try {
      const res = await fetch(
        `https://api.apollo.io/api/v1/organizations/enrich?domain=${domain}`,
        { headers: { "X-Api-Key": APOLLO_API_KEY } }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.organization) {
          return {
            name: data.organization.name,
            domain: data.organization.primary_domain || domain,
            industry: data.organization.industry,
            description: data.organization.short_description,
          };
        }
      }
    } catch { /* try next domain */ }
  }

  // Fallback: use slug as company name
  console.warn(`[apollo] Could not enrich company from LinkedIn URL, using slug: ${slug}`);
  return { name: slug, domain: null, industry: null, description: null };
}

async function apolloSearchPeople(companyName, domain) {
  const searchBody = {
    q_titles: TARGET_TITLES.join("\n"),
    per_page: 25,
  };

  if (domain) {
    searchBody.q_organization_domains = domain;
  } else {
    searchBody.q_organization_name = companyName;
  }

  const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": APOLLO_API_KEY,
    },
    body: JSON.stringify(searchBody),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    if (errText.includes("free plan")) {
      console.warn("[apollo] People search not available on free plan — falling back to LinkedIn scrape");
      return [];
    }
    throw new Error(`Apollo search failed: ${res.status} — ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const people = data.people || [];

  // Prioritize by title
  return people.map((p) => ({
    name: p.name ?? [p.first_name, p.last_name].filter(Boolean).join(" "),
    title: p.title || "",
    headline: p.headline || "",
    linkedinUrl: p.linkedin_url || null,
    email: p.email || null,
    photoUrl: p.photo_url || null,
    priority: getTitlePriority(p.title || ""),
  }))
    .filter((p) => p.name && p.linkedinUrl)
    .sort((a, b) => a.priority - b.priority);
}

function getTitlePriority(title) {
  const t = title.toLowerCase();
  if (/founder|co-founder|cofounder|ceo|cto|coo/.test(t)) return 1;
  if (/vp|vice president|head of|director/.test(t)) return 2;
  if (/founding engineer|staff|principal/.test(t)) return 3;
  if (/senior/.test(t)) return 4;
  if (/recruiter|talent|hr|people/.test(t)) return 5;
  return 6;
}

// ── LinkedIn Browser Automation ─────────────────────────────

let browser = null;
let browserContext = null;

async function launchLinkedInBrowser() {
  if (browserContext) return browserContext;

  browser = await chromium.launch({ headless: false }); // visible so user can see

  try {
    if (existsSync(STATE_PATH)) {
      const state = JSON.parse(readFileSync(STATE_PATH, "utf-8"));
      browserContext = await browser.newContext({ storageState: state });
    } else {
      browserContext = await browser.newContext();
    }
  } catch {
    browserContext = await browser.newContext();
  }

  return browserContext;
}

async function closeLinkedInBrowser() {
  if (browserContext) {
    try {
      const dir = dirname(STATE_PATH);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const state = await browserContext.storageState();
      writeFileSync(STATE_PATH, JSON.stringify(state));
    } catch (err) {
      console.warn("[browser] Failed to save state:", err.message);
    }
    await browserContext.close();
    browserContext = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}

async function readLinkedInProfile(profileUrl) {
  try {
    const ctx = await launchLinkedInBrowser();
    const page = await ctx.newPage();
    await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await sleep(randomBetween(2000, 3000));

    // Human-like scrolling
    for (let i = 0; i < 3; i++) {
      await page.evaluate((offset) => window.scrollBy(0, 300 + offset), randomBetween(-50, 100));
      await sleep(randomBetween(500, 1200));
    }

    const text = await page.evaluate(() => document.body.innerText);
    await page.close();
    return text;
  } catch (err) {
    console.warn("[browser] Failed to read profile:", err.message);
    return null;
  }
}

async function scrapeCompanyPeople(companyUrl) {
  try {
    const ctx = await launchLinkedInBrowser();
    const page = await ctx.newPage();

    const slugMatch = companyUrl.match(/\/company\/([^/?]+)/);
    if (!slugMatch) return [];
    const slug = slugMatch[1];

    const titleFilter = TARGET_TITLES.slice(0, 15).join(" ");
    const keywords = encodeURIComponent(titleFilter);
    await page.goto(
      `https://www.linkedin.com/company/${slug}/people/?keywords=${keywords}`,
      { waitUntil: "domcontentloaded", timeout: 20000 }
    );
    await sleep(randomBetween(2500, 4000));

    for (let i = 0; i < 3; i++) {
      await page.evaluate((offset) => window.scrollBy(0, 400 + offset), randomBetween(-50, 100));
      await sleep(randomBetween(800, 1500));
    }

    const employees = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll(
        '[data-view-name="search-entity-result-universal-template"],' +
        '.org-people-profile-card,' +
        '.artdeco-entity-lockup'
      );

      for (const card of Array.from(cards)) {
        const linkEl = card.querySelector('a[href*="/in/"]');
        if (!linkEl) continue;
        const nameEl = card.querySelector(
          '.artdeco-entity-lockup__title, .org-people-profile-card__profile-title, span[dir="ltr"]'
        );
        const titleEl = card.querySelector(
          '.artdeco-entity-lockup__subtitle, .org-people-profile-card__profile-info, .t-black--light'
        );
        const name = nameEl?.textContent?.trim() ?? "";
        const title = titleEl?.textContent?.trim() ?? "";
        const profileUrl = linkEl.href.split("?")[0];
        if (name && profileUrl.includes("/in/")) {
          results.push({ name, title, profileUrl });
        }
      }

      if (results.length === 0) {
        const links = document.querySelectorAll('a[href*="/in/"]');
        for (const link of Array.from(links)) {
          const href = link.href.split("?")[0];
          const text = link.textContent?.trim() ?? "";
          if (text && text.length > 2 && text.length < 60 && href.includes("/in/")) {
            const parent = link.closest("li, div, section");
            const subtitle = parent?.querySelector(
              ".t-black--light, .t-normal, [class*='subtitle']"
            )?.textContent?.trim() ?? "";
            results.push({ name: text, title: subtitle, profileUrl: href });
          }
        }
      }

      return results;
    });

    await page.close();

    const seen = new Set();
    return employees
      .filter((e) => {
        if (seen.has(e.profileUrl)) return false;
        seen.add(e.profileUrl);
        return true;
      })
      .map((e) => ({
        name: e.name,
        title: e.title,
        headline: "",
        linkedinUrl: e.profileUrl,
        email: null,
        photoUrl: null,
        priority: getTitlePriority(e.title),
      }))
      .sort((a, b) => a.priority - b.priority);
  } catch (err) {
    console.warn("[browser] Company people scrape failed:", err.message);
    return [];
  }
}

async function sendConnectionRequest(profileUrl, note) {
  try {
    const ctx = await launchLinkedInBrowser();
    const page = await ctx.newPage();
    await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await sleep(randomBetween(2000, 3000));

    // Try "Connect" button — could be in "More" dropdown
    let connectBtn = await page.$('button:has-text("Connect")');
    if (!connectBtn) {
      const moreBtn = await page.$('button:has-text("More")');
      if (moreBtn) {
        await moreBtn.click();
        await sleep(randomBetween(500, 1000));
        connectBtn = await page.$('button:has-text("Connect"), [role="menuitem"]:has-text("Connect")');
      }
    }

    if (!connectBtn) {
      console.warn("[browser] No Connect button found — may already be connected or pending");
      await page.close();
      return false;
    }

    await connectBtn.click();
    await sleep(randomBetween(1000, 2000));

    // Click "Add a note"
    const addNoteBtn = await page.$('button:has-text("Add a note")');
    if (addNoteBtn) {
      await addNoteBtn.click();
      await sleep(randomBetween(500, 1000));
    }

    // Type note with human-like delay
    const textarea = await page.$('textarea[name="message"], textarea#custom-message');
    if (textarea) {
      await textarea.click();
      for (const char of note) {
        await page.keyboard.type(char, { delay: randomBetween(35, 55) });
      }
    }

    // Click Send
    const sendBtn = await page.$('button:has-text("Send")');
    if (sendBtn) {
      await sendBtn.click();
      await sleep(randomBetween(1000, 2000));
    }

    await page.close();
    return true;
  } catch (err) {
    console.warn("[browser] Send connection failed:", err.message);
    return false;
  }
}

// ── Message Generation (Claude Haiku) ───────────────────────

async function generateMessage(candidate, company, role, cvSummary) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: `${CONTACTO_RULES}

Candidate CV summary:
${cvSummary}

The candidate is interested in the "${role}" role at ${company.name}.
${company.industry ? `Company industry: ${company.industry}` : ""}
${company.description ? `Company: ${company.description}` : ""}`,
      messages: [
        {
          role: "user",
          content: `Generate a LinkedIn connection request for:
- Name: ${candidate.name}
- Title: ${candidate.title}
- Headline: ${candidate.headline || "N/A"}
- Company: ${company.name}
- Role I'm applying for: ${role}

Return ONLY the message text, nothing else. Max 300 characters.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Anthropic API error: ${res.status} — ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  let message = data.content[0]?.text?.trim() || "";

  // Strip quotes if wrapped
  if ((message.startsWith('"') && message.endsWith('"')) ||
      (message.startsWith("'") && message.endsWith("'"))) {
    message = message.slice(1, -1);
  }

  // Enforce 300 char limit
  if (message.length > 300) {
    message = message.slice(0, 297) + "...";
  }

  return message;
}

// ── Logging ─────────────────────────────────────────────────

function loadSentLog() {
  if (!existsSync(LOG_FILE)) return new Set();
  const lines = readFileSync(LOG_FILE, "utf-8").split("\n").filter(Boolean);
  const urls = new Set();
  for (const line of lines.slice(1)) { // skip header
    const parts = line.split("\t");
    if (parts[4]) urls.add(parts[4]); // linkedin_url column
  }
  return urls;
}

function logAction(company, candidate, status, message) {
  const dir = dirname(LOG_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  if (!existsSync(LOG_FILE)) {
    appendFileSync(LOG_FILE, "date\tcompany\tname\ttitle\tlinkedin_url\tstatus\tmessage\n");
  }

  const date = new Date().toISOString().slice(0, 10);
  const sanitizedMsg = message.replace(/\t/g, " ").replace(/\n/g, " ");
  appendFileSync(LOG_FILE, `${date}\t${company}\t${candidate.name}\t${candidate.title}\t${candidate.linkedinUrl}\t${status}\t${sanitizedMsg}\n`);
}

// ── Terminal Interaction ────────────────────────────────────

function createReadline() {
  return createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function promptForApproval(rl, candidate, message, index, total) {
  const bar = "━".repeat(50);
  console.log(`\n${bar}`);
  console.log(`[${index + 1}/${total}] ${candidate.name} — ${candidate.title}`);
  console.log(`LinkedIn: ${candidate.linkedinUrl}`);
  if (candidate.email) console.log(`Email: ${candidate.email}`);
  console.log(bar);
  console.log(`\nMessage (${message.length}/300 chars):`);
  console.log(`"${message}"`);
  console.log();

  while (true) {
    const answer = (await ask(rl, "[y]es / [n]o / [e]dit > ")).trim().toLowerCase();

    if (answer === "y" || answer === "yes") return { action: "send", message };
    if (answer === "n" || answer === "no") return { action: "skip", message };
    if (answer === "e" || answer === "edit") {
      const edited = (await ask(rl, "New message (max 300 chars): ")).trim();
      if (edited.length > 300) {
        console.log(`⚠ Message is ${edited.length} chars — max 300. Try again.`);
        continue;
      }
      if (edited.length === 0) {
        console.log("Empty message — keeping original.");
        continue;
      }
      console.log(`\nUpdated (${edited.length}/300 chars):`);
      console.log(`"${edited}"`);
      const confirm = (await ask(rl, "Send this? [y/n] > ")).trim().toLowerCase();
      if (confirm === "y" || confirm === "yes") return { action: "send", message: edited };
      continue;
    }

    console.log('Please enter y, n, or e');
  }
}

// ── Helpers ─────────────────────────────────────────────────

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadCvSummary() {
  const cvPath = resolve(__dirname, "cv.md");
  if (!existsSync(cvPath)) {
    console.warn("[cv] cv.md not found — messages will be less personalized");
    return "No CV available.";
  }
  const cv = readFileSync(cvPath, "utf-8");
  // Take first ~1500 chars as summary (enough for context, saves tokens)
  return cv.slice(0, 1500);
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  // Validate env vars
  if (!APOLLO_API_KEY) {
    console.error("Error: APOLLO_API_KEY environment variable is required");
    console.error("Get a free key at https://app.apollo.io/");
    process.exit(1);
  }
  if (!ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required");
    process.exit(1);
  }

  console.log("\n🔍 LinkedIn Outreach Connect");
  console.log(`Company: ${args.company}`);
  console.log(`Role: ${args.role}`);
  console.log(`Max candidates: ${args.max}`);
  if (args.dryRun) console.log("Mode: DRY RUN (no messages will be sent)\n");
  else console.log();

  // Step 1: Enrich company via Apollo
  console.log("[1/4] Enriching company via Apollo...");
  const company = await apolloEnrichCompany(args.company);
  console.log(`  Company: ${company.name}`);
  if (company.domain) console.log(`  Domain: ${company.domain}`);
  if (company.industry) console.log(`  Industry: ${company.industry}`);

  // Step 2: Find people
  console.log("\n[2/4] Searching for candidates...");
  let candidates = await apolloSearchPeople(company.name, company.domain);

  // Fallback to LinkedIn scrape if Apollo returns nothing
  if (candidates.length === 0) {
    console.log("  Apollo returned no results — scraping LinkedIn company page...");
    candidates = await scrapeCompanyPeople(args.company);
  }

  if (candidates.length === 0) {
    console.log("\n❌ No candidates found. Try:");
    console.log("  - Check the LinkedIn company URL is correct");
    console.log("  - The company may be too small for Apollo's database");
    await closeLinkedInBrowser();
    process.exit(0);
  }

  // Dedup against already-sent
  const sentUrls = loadSentLog();
  candidates = candidates.filter((c) => {
    if (sentUrls.has(c.linkedinUrl)) {
      console.log(`  Skipping ${c.name} — already in outreach log`);
      return false;
    }
    return true;
  });

  // Limit
  candidates = candidates.slice(0, args.max);
  console.log(`  Found ${candidates.length} candidates:\n`);

  for (const c of candidates) {
    console.log(`  [P${c.priority}] ${c.name} — ${c.title}`);
  }

  // Step 3: Load CV for message generation
  const cvSummary = loadCvSummary();

  // Step 4: Process each candidate
  console.log("\n[3/4] Generating messages and processing candidates...\n");

  const rl = createReadline();
  const stats = { sent: 0, skipped: 0, errors: 0 };

  // Handle Ctrl+C gracefully
  process.on("SIGINT", async () => {
    console.log("\n\n⚠ Interrupted — saving progress...");
    rl.close();
    await closeLinkedInBrowser();
    printSummary(stats, candidates.length);
    process.exit(0);
  });

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];

    try {
      // Generate personalized message
      const message = await generateMessage(candidate, company, args.role, cvSummary);

      // Prompt user
      const result = await promptForApproval(rl, candidate, message, i, candidates.length);

      if (result.action === "skip") {
        logAction(company.name, candidate, "skipped", result.message);
        stats.skipped++;
        continue;
      }

      if (args.dryRun) {
        console.log("  [DRY RUN] Would send connection request");
        logAction(company.name, candidate, "dry-run", result.message);
        stats.sent++;
        continue;
      }

      // Send connection request
      console.log("  Sending connection request...");
      const success = await sendConnectionRequest(candidate.linkedinUrl, result.message);

      if (success) {
        console.log("  ✅ Sent!");
        logAction(company.name, candidate, "sent", result.message);
        stats.sent++;
      } else {
        console.log("  ❌ Failed to send (may already be connected/pending)");
        logAction(company.name, candidate, "error", result.message);
        stats.errors++;
      }

      // Random delay between sends (30-90 seconds)
      if (i < candidates.length - 1) {
        const delay = randomBetween(30000, 90000);
        console.log(`  ⏳ Waiting ${Math.round(delay / 1000)}s before next...`);
        await sleep(delay);
      }
    } catch (err) {
      console.error(`  ❌ Error processing ${candidate.name}: ${err.message}`);
      logAction(company.name, candidate, "error", err.message);
      stats.errors++;
    }
  }

  rl.close();

  // Cleanup
  console.log("\n[4/4] Cleaning up...");
  await closeLinkedInBrowser();

  printSummary(stats, candidates.length);
}

function printSummary(stats, total) {
  console.log("\n" + "━".repeat(50));
  console.log("Summary:");
  console.log(`  Total candidates: ${total}`);
  console.log(`  ✅ Sent: ${stats.sent}`);
  console.log(`  ⏭  Skipped: ${stats.skipped}`);
  console.log(`  ❌ Errors: ${stats.errors}`);
  console.log(`  Log: ${LOG_FILE}`);
  console.log("━".repeat(50) + "\n");
}

main().catch(async (err) => {
  console.error("\n❌ Fatal error:", err.message);
  await closeLinkedInBrowser();
  process.exit(1);
});
