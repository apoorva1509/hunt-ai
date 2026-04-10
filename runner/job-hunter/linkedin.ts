/**
 * LinkedIn browser automation via Playwright/CloakBrowser.
 *
 * Read operations run headless. Write operations (send) require user approval
 * in the dashboard first — they are never called automatically by the pipeline.
 */

import type { Browser, BrowserContext, Page } from "playwright-core";

const STATE_PATH =
  process.env.LINKEDIN_STATE_PATH ??
  `${process.env.HOME}/.suprdash/linkedin-state.json`;

let browser: Browser | null = null;
let context: BrowserContext | null = null;

/**
 * Launch the browser and restore LinkedIn session.
 * Tries CloakBrowser first, falls back to playwright-core chromium.
 */
export async function launchBrowser(): Promise<BrowserContext> {
  if (context) return context;

  try {
    // Try CloakBrowser (anti-detect)
    const cloakbrowser = await import("cloakbrowser");
    browser = await cloakbrowser.launch({ headless: true });
  } catch {
    // Fallback to regular Playwright
    const pw = await import("playwright-core");
    browser = await pw.chromium.launch({ headless: true });
  }

  // Restore session state if it exists
  try {
    const fs = await import("fs");
    if (fs.existsSync(STATE_PATH)) {
      const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
      context = await browser.newContext({ storageState: state });
    } else {
      context = await browser.newContext();
    }
  } catch {
    context = await browser.newContext();
  }

  return context;
}

/**
 * Save session state and close browser.
 */
export async function closeBrowser(): Promise<void> {
  if (context) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const dir = path.dirname(STATE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const state = await context.storageState();
      fs.writeFileSync(STATE_PATH, JSON.stringify(state));
    } catch (err) {
      console.warn("[linkedin] Failed to save state:", (err as Error).message);
    }
    await context.close();
    context = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Read a LinkedIn profile and return the raw page text.
 */
export async function readLinkedInProfile(
  profileUrl: string
): Promise<string | null> {
  try {
    const ctx = await launchBrowser();
    const page = await ctx.newPage();

    await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await sleep(randomBetween(2000, 3000));

    // Human-like scrolling: 4 times with random offsets
    for (let i = 0; i < 4; i++) {
      await page.evaluate((offset) => {
        window.scrollBy(0, 300 + offset);
      }, randomBetween(-50, 100));
      await sleep(randomBetween(500, 1200));
    }

    const text = await page.evaluate(() => document.body.innerText);
    await page.close();
    return text;
  } catch (err) {
    console.warn("[linkedin] Failed to read profile:", (err as Error).message);
    return null;
  }
}

/**
 * Search LinkedIn for a person and return their profile URL.
 */
export async function searchLinkedInPerson(
  name: string,
  company: string
): Promise<string | null> {
  try {
    const ctx = await launchBrowser();
    const page = await ctx.newPage();
    const query = encodeURIComponent(`${name} ${company}`);

    await page.goto(
      `https://www.linkedin.com/search/results/people/?keywords=${query}`,
      { waitUntil: "domcontentloaded", timeout: 15000 }
    );
    await sleep(randomBetween(2000, 3000));

    const firstResult = await page.evaluate(() => {
      const link = document.querySelector(
        'a[href*="/in/"]'
      ) as HTMLAnchorElement | null;
      return link?.href ?? null;
    });

    await page.close();
    return firstResult;
  } catch (err) {
    console.warn("[linkedin] Search failed:", (err as Error).message);
    return null;
  }
}

// ── Company Employee Discovery ───────────────────────────────

/**
 * Find a company's LinkedIn page URL by searching LinkedIn.
 */
export async function findCompanyLinkedIn(
  companyName: string
): Promise<string | null> {
  try {
    const ctx = await launchBrowser();
    const page = await ctx.newPage();
    const query = encodeURIComponent(companyName);

    await page.goto(
      `https://www.linkedin.com/search/results/companies/?keywords=${query}`,
      { waitUntil: "domcontentloaded", timeout: 15000 }
    );
    await sleep(randomBetween(2000, 3000));

    const companyUrl = await page.evaluate(() => {
      const link = document.querySelector(
        'a[href*="/company/"]'
      ) as HTMLAnchorElement | null;
      if (!link) return null;
      const href = link.href;
      const match = href.match(/\/company\/([^/?]+)/);
      return match ? `https://www.linkedin.com/company/${match[1]}/` : null;
    });

    await page.close();
    return companyUrl;
  } catch (err) {
    console.warn(`[linkedin] Company search failed for ${companyName}:`, (err as Error).message);
    return null;
  }
}

export interface LinkedInEmployee {
  name: string;
  title: string;
  profileUrl: string;
}

/**
 * Browse a company's LinkedIn People tab filtered by leadership titles.
 * Returns employee names, titles, and profile URLs.
 */
export async function getCompanyPeople(
  companyUrl: string,
  titleFilter = "CTO CEO Founder Co-founder VP Engineering Head Engineering Manager Tech Lead Recruiter Talent Acquisition Hiring HR People Operations Senior Software Engineer Founding Engineer SDE Staff Engineer Principal Engineer"
): Promise<LinkedInEmployee[]> {
  try {
    const ctx = await launchBrowser();
    const page = await ctx.newPage();

    // Extract company slug from URL
    const slugMatch = companyUrl.match(/\/company\/([^/?]+)/);
    if (!slugMatch) return [];
    const slug = slugMatch[1];

    const keywords = encodeURIComponent(titleFilter);
    await page.goto(
      `https://www.linkedin.com/company/${slug}/people/?keywords=${keywords}`,
      { waitUntil: "domcontentloaded", timeout: 20000 }
    );
    await sleep(randomBetween(2500, 4000));

    // Scroll to load more results
    for (let i = 0; i < 3; i++) {
      await page.evaluate((offset) => window.scrollBy(0, 400 + offset), randomBetween(-50, 100));
      await sleep(randomBetween(800, 1500));
    }

    const employees = await page.evaluate(() => {
      const results: Array<{ name: string; title: string; profileUrl: string }> = [];
      // LinkedIn people cards typically have profile links and title text
      const cards = document.querySelectorAll(
        '[data-view-name="search-entity-result-universal-template"],' +
        '.org-people-profile-card,' +
        '.artdeco-entity-lockup'
      );

      for (const card of Array.from(cards)) {
        const linkEl = card.querySelector('a[href*="/in/"]') as HTMLAnchorElement | null;
        if (!linkEl) continue;

        const nameEl = card.querySelector(
          '.artdeco-entity-lockup__title,' +
          '.org-people-profile-card__profile-title,' +
          'span[dir="ltr"]'
        );
        const titleEl = card.querySelector(
          '.artdeco-entity-lockup__subtitle,' +
          '.org-people-profile-card__profile-info,' +
          '.t-black--light'
        );

        const name = nameEl?.textContent?.trim() ?? "";
        const title = titleEl?.textContent?.trim() ?? "";
        const profileUrl = linkEl.href.split("?")[0];

        if (name && profileUrl.includes("/in/")) {
          results.push({ name, title, profileUrl });
        }
      }

      // Fallback: just grab all /in/ links with nearby text
      if (results.length === 0) {
        const links = document.querySelectorAll('a[href*="/in/"]');
        for (const link of Array.from(links)) {
          const href = (link as HTMLAnchorElement).href.split("?")[0];
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

    // Deduplicate by profile URL
    const seen = new Set<string>();
    return employees.filter((e) => {
      if (seen.has(e.profileUrl)) return false;
      seen.add(e.profileUrl);
      return true;
    });
  } catch (err) {
    console.warn("[linkedin] Company people lookup failed:", (err as Error).message);
    return [];
  }
}

// ── Write Operations (approval-gated) ────────────────────────

/**
 * Send a LinkedIn connection request with a note.
 * Only call this AFTER the user has approved the draft in the dashboard.
 */
export async function sendConnectionRequest(
  profileUrl: string,
  note: string
): Promise<boolean> {
  try {
    const ctx = await launchBrowser();
    const page = await ctx.newPage();

    await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await sleep(randomBetween(2000, 3000));

    // Click Connect button
    const connectBtn = await page.$('button:has-text("Connect")');
    if (!connectBtn) {
      console.warn("[linkedin] No Connect button found");
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
    const textarea = await page.$('textarea[name="message"]');
    if (textarea) {
      await humanType(page, textarea, note);
    }

    // Click Send
    const sendBtn = await page.$('button:has-text("Send")');
    if (sendBtn) {
      await sendBtn.click();
      await sleep(randomBetween(1000, 2000));
    }

    await page.close();
    // Random delay between sends (30-60s)
    await sleep(randomBetween(30000, 60000));
    return true;
  } catch (err) {
    console.warn("[linkedin] Send connection failed:", (err as Error).message);
    return false;
  }
}

/**
 * Send a direct message on LinkedIn.
 * Only call this AFTER the user has approved the draft in the dashboard.
 */
export async function sendDirectMessage(
  profileUrl: string,
  message: string
): Promise<boolean> {
  try {
    const ctx = await launchBrowser();
    const page = await ctx.newPage();

    await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await sleep(randomBetween(2000, 3000));

    const msgBtn = await page.$('button:has-text("Message")');
    if (!msgBtn) {
      console.warn("[linkedin] No Message button found");
      await page.close();
      return false;
    }
    await msgBtn.click();
    await sleep(randomBetween(1000, 2000));

    const msgBox = await page.$('div[role="textbox"]');
    if (msgBox) {
      await humanType(page, msgBox, message);
      await sleep(randomBetween(500, 1000));
      await page.keyboard.press("Control+Enter");
    }

    await page.close();
    await sleep(randomBetween(30000, 60000));
    return true;
  } catch (err) {
    console.warn("[linkedin] Send DM failed:", (err as Error).message);
    return false;
  }
}

// ── Helpers ──────────────────────────────────────────────────

async function humanType(
  page: Page,
  element: any,
  text: string
): Promise<void> {
  await element.click();
  for (const char of text) {
    await page.keyboard.type(char, {
      delay: randomBetween(35, 55),
    });
  }
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
