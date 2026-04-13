import { NextRequest, NextResponse } from "next/server";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";

// ── Logger ──────────────────────────────────────────────────

const TAG = "[outreach-connect]";

function log(...args: any[]) {
  console.log(TAG, new Date().toISOString().slice(11, 19), ...args);
}
function logWarn(...args: any[]) {
  console.warn(TAG, new Date().toISOString().slice(11, 19), "⚠", ...args);
}
function logError(...args: any[]) {
  console.error(TAG, new Date().toISOString().slice(11, 19), "❌", ...args);
}

// ── Browser Singleton ───────────────────────────────────────

const STATE_PATH =
  process.env.LINKEDIN_STATE_PATH ??
  `${process.env.HOME}/.suprdash/linkedin-state.json`;

const WEEKLY_LOG_PATH = resolve(process.cwd(), "..", "batch", "outreach-weekly.json");
const WEEKLY_LIMIT = 80;

let browser: Browser | null = null;
let context: BrowserContext | null = null;

async function getBrowserContext(): Promise<BrowserContext> {
  if (context) {
    log("Reusing existing browser context");
    return context;
  }

  log("Launching new Chromium browser (headless: false)...");
  browser = await chromium.launch({ headless: false });
  log("Browser launched");

  const hasState = existsSync(STATE_PATH);
  log(`LinkedIn session file: ${hasState ? "found" : "NOT FOUND"} (${STATE_PATH})`);

  try {
    if (hasState) {
      const state = JSON.parse(readFileSync(STATE_PATH, "utf-8"));
      context = await browser.newContext({ storageState: state });
      log("Browser context created with saved session");
    } else {
      context = await browser.newContext();
      logWarn("Browser context created WITHOUT session — you may need to log in");
    }
  } catch (err: any) {
    logWarn("Failed to load session, creating fresh context:", err.message);
    context = await browser.newContext();
  }

  return context;
}

async function saveBrowserState(): Promise<void> {
  if (!context) return;
  try {
    const dir = dirname(STATE_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const state = await context.storageState();
    writeFileSync(STATE_PATH, JSON.stringify(state));
    log("Browser state saved to", STATE_PATH);
  } catch (err: any) {
    logWarn("Failed to save browser state:", err.message);
  }
}

// ── Weekly Limit Tracking ───────────────────────────────────

function getWeeklyCount(): { count: number; weekStart: string } {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekKey = weekStart.toISOString().slice(0, 10);

  try {
    if (existsSync(WEEKLY_LOG_PATH)) {
      const data = JSON.parse(readFileSync(WEEKLY_LOG_PATH, "utf-8"));
      if (data.weekStart === weekKey) {
        return { count: data.count, weekStart: weekKey };
      }
    }
  } catch { /* start fresh */ }
  return { count: 0, weekStart: weekKey };
}

function incrementWeeklyCount(): void {
  const { count, weekStart } = getWeeklyCount();
  const dir = dirname(WEEKLY_LOG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const newCount = count + 1;
  writeFileSync(WEEKLY_LOG_PATH, JSON.stringify({ weekStart, count: newCount }));
  log(`Weekly send count: ${newCount}/${WEEKLY_LIMIT}`);
}

// ── Helpers ─────────────────────────────────────────────────

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function humanType(page: Page, element: any, text: string): Promise<void> {
  await element.click();
  log(`Typing ${text.length} chars with human-like delay...`);
  for (const char of text) {
    await page.keyboard.type(char, { delay: randomBetween(30, 60) });
  }
  log("Typing complete");
}

async function detectPageState(page: Page): Promise<{
  isLoggedIn: boolean;
  hasCaptcha: boolean;
  hasSecurityCheck: boolean;
}> {
  const bodyText = await page.evaluate(() => document.body.innerText).catch(() => "");
  const url = page.url();
  const result = {
    isLoggedIn: !url.includes("/login") && !url.includes("/authwall"),
    hasCaptcha: bodyText.includes("security verification") || url.includes("/checkpoint"),
    hasSecurityCheck: url.includes("/checkpoint") || bodyText.includes("unusual activity"),
  };
  log(`Page state — logged in: ${result.isLoggedIn}, captcha: ${result.hasCaptcha}, security: ${result.hasSecurityCheck}, url: ${url.slice(0, 80)}`);
  return result;
}

// ── Profile Status Detection ────────────────────────────────

async function detectConnectionStatus(page: Page): Promise<
  "not_connected" | "already_connected" | "pending" | "follow_only" | "error"
> {
  try {
    log("Waiting for profile to load...");
    await page.waitForSelector('main', { timeout: 10000 }).catch(() => {});
    const waitMs = randomBetween(1500, 2500);
    log(`Profile loaded, waiting ${waitMs}ms for elements...`);
    await sleep(waitMs);

    const messageBtn = await page.$('button:has-text("Message")');
    const connectBtn = await page.$('button:has-text("Connect")');
    const pendingBtn = await page.$('button:has-text("Pending")');
    const followBtn = await page.$('button:has-text("Follow")');

    log(`Buttons found — Message: ${!!messageBtn}, Connect: ${!!connectBtn}, Pending: ${!!pendingBtn}, Follow: ${!!followBtn}`);

    let moreConnectBtn = null;
    let morePendingBtn = null;
    const moreBtn = await page.$('button:has-text("More")');
    if (moreBtn && !connectBtn && !pendingBtn) {
      log("Checking 'More' dropdown for Connect button...");
      await moreBtn.click();
      await sleep(randomBetween(500, 1000));
      moreConnectBtn = await page.$('[role="menuitem"]:has-text("Connect"), button:has-text("Connect")');
      morePendingBtn = await page.$('[role="menuitem"]:has-text("Pending")');
      log(`More dropdown — Connect: ${!!moreConnectBtn}, Pending: ${!!morePendingBtn}`);
      await page.keyboard.press("Escape");
      await sleep(300);
    }

    let status: "not_connected" | "already_connected" | "pending" | "follow_only" | "error";
    if (pendingBtn || morePendingBtn) status = "pending";
    else if (messageBtn && !connectBtn && !moreConnectBtn) status = "already_connected";
    else if (connectBtn || moreConnectBtn) status = "not_connected";
    else if (followBtn && !connectBtn && !moreConnectBtn) status = "follow_only";
    else status = "error";

    log(`Connection status detected: ${status}`);
    return status;
  } catch (err: any) {
    logError("Status detection failed:", err.message);
    return "error";
  }
}

// ── POST /api/outreach-connect/send ─────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, profileUrl, message, resumePath } = body;

    log(`\n${"=".repeat(60)}`);
    log(`ACTION: ${action} | URL: ${profileUrl?.slice(0, 60)}`);
    if (message) log(`Message length: ${message.length} chars`);
    log("=".repeat(60));

    if (!profileUrl) {
      logError("Missing profileUrl");
      return NextResponse.json({ error: "profileUrl is required" }, { status: 400 });
    }

    // Weekly limit check
    if (action === "send_connection") {
      const { count } = getWeeklyCount();
      log(`Weekly limit check: ${count}/${WEEKLY_LIMIT}`);
      if (count >= WEEKLY_LIMIT) {
        logError(`Weekly limit REACHED (${count}/${WEEKLY_LIMIT}) — blocking send`);
        return NextResponse.json({
          error: `Weekly limit reached (${count}/${WEEKLY_LIMIT}). Wait until next week.`,
          weeklyCount: count,
          weeklyLimit: WEEKLY_LIMIT,
        }, { status: 429 });
      }
    }

    log("Getting browser context...");
    const ctx = await getBrowserContext();
    const page = await ctx.newPage();
    log("New page opened");

    try {
      log(`Navigating to ${profileUrl}...`);
      await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      const waitMs = randomBetween(2000, 3500);
      log(`Page loaded, waiting ${waitMs}ms...`);
      await sleep(waitMs);

      // Check login state
      const pageState = await detectPageState(page);
      if (!pageState.isLoggedIn) {
        logError("SESSION EXPIRED — user needs to log in");
        await page.close();
        return NextResponse.json({
          error: "LinkedIn session expired. Please log in to LinkedIn in the browser window and try again.",
          code: "SESSION_EXPIRED",
        }, { status: 401 });
      }
      if (pageState.hasCaptcha || pageState.hasSecurityCheck) {
        logError("CAPTCHA / SECURITY CHECK detected");
        await page.close();
        return NextResponse.json({
          error: "LinkedIn is showing a security checkpoint. Please resolve it in the browser window and try again.",
          code: "CAPTCHA",
        }, { status: 403 });
      }

      // ── ACTION: CHECK STATUS ──
      if (action === "check") {
        log("--- CHECK STATUS ---");
        const status = await detectConnectionStatus(page);
        await page.close();
        await saveBrowserState();
        log(`CHECK COMPLETE: ${status}`);
        return NextResponse.json({ status, profileUrl });
      }

      // ── ACTION: SEND CONNECTION REQUEST ──
      if (action === "send_connection") {
        log("--- SEND CONNECTION REQUEST ---");

        // Detect current status
        const status = await detectConnectionStatus(page);
        if (status === "already_connected") {
          logWarn("Already connected — cannot send connection request");
          await page.close();
          return NextResponse.json({ error: "Already connected — use send_dm instead", code: "ALREADY_CONNECTED" }, { status: 409 });
        }
        if (status === "pending") {
          logWarn("Connection request already pending");
          await page.close();
          return NextResponse.json({ error: "Connection request already pending", code: "PENDING" }, { status: 409 });
        }
        if (status === "follow_only") {
          logWarn("Profile is follow-only, no Connect button");
          await page.close();
          return NextResponse.json({ error: "This profile only allows Follow, not Connect", code: "FOLLOW_ONLY" }, { status: 409 });
        }

        // Find Connect button
        log("Looking for Connect button...");
        let connectBtn = await page.$('button:has-text("Connect")');
        if (!connectBtn) {
          log("Connect not found in main buttons, checking More dropdown...");
          const moreBtn = await page.$('button:has-text("More")');
          if (moreBtn) {
            await moreBtn.click();
            await sleep(randomBetween(500, 1000));
            connectBtn = await page.$('[role="menuitem"]:has-text("Connect"), button:has-text("Connect")');
            log(`Connect in More dropdown: ${!!connectBtn}`);
          }
        }

        if (!connectBtn) {
          logError("Connect button NOT FOUND anywhere on page");
          await page.close();
          return NextResponse.json({ error: "Connect button not found", code: "NO_CONNECT_BUTTON" }, { status: 404 });
        }

        log("Clicking Connect button...");
        await connectBtn.click();
        await sleep(randomBetween(1000, 2000));

        // Try to add a note
        log("Looking for 'Add a note' button...");
        const addNoteBtn = await page.$('button:has-text("Add a note")');
        let noteAdded = false;
        if (addNoteBtn) {
          log("'Add a note' found — clicking...");
          await addNoteBtn.click();
          await sleep(randomBetween(500, 1000));

          log("Looking for message textarea...");
          const textarea = await page.$('textarea[name="message"], textarea#custom-message, textarea');
          if (textarea) {
            log("Textarea found — typing message...");
            await humanType(page, textarea, message);
            await sleep(randomBetween(500, 1000));
            noteAdded = true;
          } else {
            logWarn("Textarea NOT FOUND — sending without note");
          }
        } else {
          logWarn("'Add a note' button NOT AVAILABLE — LinkedIn may have restricted notes. Sending without note.");
        }

        // Click Send — try multiple selectors (LinkedIn changes these)
        log("Looking for Send button...");

        // Log all visible buttons in the modal for debugging
        const allButtons = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          return btns
            .filter((b) => b.offsetParent !== null) // visible only
            .map((b) => ({
              text: b.textContent?.trim().slice(0, 50),
              ariaLabel: b.getAttribute("aria-label"),
              classes: b.className.slice(0, 60),
            }));
        });
        log("Visible buttons on page:", JSON.stringify(allButtons.filter((b) =>
          b.text?.toLowerCase().includes("send") ||
          b.ariaLabel?.toLowerCase().includes("send") ||
          b.text?.toLowerCase().includes("connect") ||
          b.text?.toLowerCase().includes("note")
        ), null, 0));

        // Try selectors in order of specificity
        const sendSelectors = [
          'button[aria-label="Send now"]',
          'button[aria-label="Send invitation"]',
          'button[aria-label="Send"]',
          'button:has-text("Send now")',
          'button:has-text("Send invitation")',
          'button:has-text("Send")',
        ];

        let sendBtn = null;
        for (const sel of sendSelectors) {
          sendBtn = await page.$(sel);
          if (sendBtn) {
            log(`Send button found with selector: ${sel}`);
            break;
          }
        }

        if (sendBtn) {
          log("Clicking Send...");
          await sendBtn.click();
          await sleep(randomBetween(1500, 2500));
          log("Send button clicked successfully");
        } else {
          // Last resort: try pressing Enter
          logWarn("Send button NOT FOUND with any selector — trying Enter key as fallback");
          await page.keyboard.press("Enter");
          await sleep(randomBetween(1500, 2500));
          log("Enter key pressed as Send fallback");
        }

        incrementWeeklyCount();
        const { count } = getWeeklyCount();

        await page.close();
        await saveBrowserState();

        log(`✅ CONNECTION REQUEST SENT (note: ${noteAdded ? "yes" : "no"}) | Weekly: ${count}/${WEEKLY_LIMIT}`);
        return NextResponse.json({
          success: true,
          type: "connection",
          hasNote: noteAdded,
          weeklyCount: count,
          weeklyLimit: WEEKLY_LIMIT,
        });
      }

      // ── ACTION: SEND DM ──
      if (action === "send_dm") {
        log("--- SEND DIRECT MESSAGE ---");

        if (!message) {
          logError("No message provided for DM");
          await page.close();
          return NextResponse.json({ error: "message is required" }, { status: 400 });
        }

        log("Looking for Message button...");
        const msgBtn = await page.$('button:has-text("Message")');
        if (!msgBtn) {
          logError("Message button NOT FOUND — may not be connected");
          await page.close();
          return NextResponse.json({ error: "No Message button — may not be connected", code: "NOT_CONNECTED" }, { status: 404 });
        }

        log("Clicking Message button...");
        await msgBtn.click();
        await sleep(randomBetween(1500, 2500));

        log("Waiting for message textbox...");
        const msgBox = await page.waitForSelector('div[role="textbox"]', { timeout: 5000 }).catch(() => null);
        if (!msgBox) {
          logError("Message textbox NOT FOUND");
          await page.close();
          return NextResponse.json({ error: "Message box not found", code: "NO_MSG_BOX" }, { status: 500 });
        }

        log("Textbox found — typing DM...");
        await humanType(page, msgBox, message);
        await sleep(randomBetween(500, 1000));

        // Attach resume if provided
        let resumeAttached = false;
        if (resumePath) {
          log(`Resume path provided: ${resumePath}`);
          if (existsSync(resumePath)) {
            try {
              log("Looking for file attachment button...");
              const attachBtn = await page.$('button[aria-label="Attach a file"], button:has-text("Attach")');
              if (attachBtn) {
                const fileInput = await page.$('input[type="file"]');
                if (fileInput) {
                  log("Attaching resume file...");
                  await fileInput.setInputFiles(resumePath);
                  await sleep(randomBetween(2000, 3000));
                  resumeAttached = true;
                  log("Resume attached successfully");
                } else {
                  logWarn("File input not found");
                }
              } else {
                logWarn("Attach button not found");
              }
            } catch (err: any) {
              logWarn("Resume attachment failed:", err.message);
            }
          } else {
            logWarn(`Resume file not found at: ${resumePath}`);
          }
        }

        // Send
        log("Looking for Send button in DM...");
        const sendMsgBtn = await page.$('button[aria-label="Send"], button:has-text("Send")');
        if (sendMsgBtn) {
          log("Clicking Send in DM...");
          await sendMsgBtn.click();
        } else {
          log("No Send button found — pressing Enter to send...");
          await page.keyboard.press("Enter");
        }
        await sleep(randomBetween(1500, 2500));

        // Close message window
        const closeBtn = await page.$('button[aria-label="Close your conversation"]');
        if (closeBtn) {
          await closeBtn.click();
          log("Message window closed");
        }

        await page.close();
        await saveBrowserState();

        log(`✅ DM SENT (resume: ${resumeAttached ? "yes" : "no"})`);
        return NextResponse.json({
          success: true,
          type: "dm",
          resumeAttached,
        });
      }

      logError(`Unknown action: ${action}`);
      await page.close();
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    } catch (err: any) {
      logError(`EXCEPTION during ${action}:`, err.message);
      logError("Stack:", err.stack?.split("\n").slice(0, 3).join(" | "));
      await page.close().catch(() => {});
      throw err;
    }
  } catch (err: any) {
    logError("TOP-LEVEL ERROR:", err.message);
    await saveBrowserState().catch(() => {});
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

// ── GET: Weekly stats ───────────────────────────────────────

export async function GET() {
  const { count, weekStart } = getWeeklyCount();
  log(`GET weekly stats: ${count}/${WEEKLY_LIMIT} (week of ${weekStart})`);
  return NextResponse.json({ weeklyCount: count, weeklyLimit: WEEKLY_LIMIT, weekStart });
}
