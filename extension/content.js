// Career Ops - LinkedIn Extension
// Two features:
// 1. "Paste Follow-up" — pastes clipboard into LinkedIn composer
// 2. "Sync Messages" — scrapes conversation messages and sends to Convex

const PASTE_BTN_ID = "career-ops-paste-btn";
const SYNC_BTN_ID = "career-ops-sync-btn";
const TOOLBAR_ID = "career-ops-toolbar";

// ─── Config ───────────────────────────────────────────────────
const CONVEX_URL = "https://steady-opossum-661.convex.cloud";

function getConvexUrl() {
  return CONVEX_URL;
}

// ─── DOM Helpers ──────────────────────────────────────────────

function findComposer() {
  return (
    document.querySelector(
      'div.msg-form__contenteditable[contenteditable="true"]'
    ) || document.querySelector('div[role="textbox"][contenteditable="true"]')
  );
}

/**
 * Get the LinkedIn profile URL of the conversation partner.
 * Looks in the conversation header for a profile link.
 */
function getConversationPartnerUrl() {
  // Full-page messaging
  const headerLink =
    document.querySelector("a.msg-thread__link-to-profile") ||
    document.querySelector(
      'a.msg-overlay-bubble-header__link[href*="/in/"]'
    ) ||
    document.querySelector('a[href*="/in/"][data-control-name*="profile"]');

  if (headerLink) return headerLink.getAttribute("href");

  // Try profile links in the header area
  const headerArea =
    document.querySelector(".msg-thread__header") ||
    document.querySelector(".msg-overlay-conversation-bubble__header");
  if (headerArea) {
    const link = headerArea.querySelector('a[href*="/in/"]');
    if (link) return link.getAttribute("href");
  }

  // Fallback: extract from URL if it contains a profile identifier
  return null;
}

/**
 * Get the logged-in user's name for sent/received detection.
 */
function getMyName() {
  // Try the nav profile element
  const navProfile = document.querySelector(
    ".global-nav__me-content .t-14"
  );
  if (navProfile) return navProfile.textContent.trim();

  // Try alt text on profile photo
  const photo = document.querySelector(
    'img.global-nav__me-photo, img[alt*="photo"]'
  );
  if (photo) {
    const alt = photo.getAttribute("alt") || "";
    // Alt is usually "Your Name's photo" or just "Your Name"
    return alt.replace(/'s?\s*photo$/i, "").trim();
  }

  return null;
}

/**
 * Scrape all visible messages from the current conversation.
 */
function scrapeMessages() {
  const messages = [];
  const myName = getMyName();

  // Find all message items
  const items = document.querySelectorAll(
    'li[class*="msg-s-event-listitem"], .msg-s-event-listitem'
  );

  for (const item of items) {
    // Extract message body
    const bodyEl =
      item.querySelector(".msg-s-event-listitem__body") ||
      item.querySelector('p[class*="msg-s-event-listitem"]');
    if (!bodyEl) continue;

    const body = bodyEl.textContent.trim();
    if (!body) continue;

    // Extract sender name
    const senderEl =
      item.querySelector(".msg-s-message-group__name") ||
      item.querySelector('[class*="msg-s-message-group__meta"] .t-14');
    const senderName = senderEl ? senderEl.textContent.trim() : "";

    // Determine direction
    let direction = "inbound";

    // Method 1: CSS class based
    if (
      item.classList.contains("msg-s-message-group--outbound") ||
      item.closest(".msg-s-message-group--outbound")
    ) {
      direction = "outbound";
    } else if (
      !item.classList.contains("msg-s-event-listitem--other") &&
      !item.closest(".msg-s-event-listitem--other")
    ) {
      // No --other class often means it's our message
      // But verify with sender name if available
      if (myName && senderName && senderName.includes(myName.split(" ")[0])) {
        direction = "outbound";
      }
    }

    // Method 2: Check bubble styling (sent messages have blue bg)
    const bubble = item.querySelector(
      '[class*="msg-s-event-listitem__message-bubble"]'
    );
    if (bubble) {
      const classes = bubble.className;
      if (
        classes.includes("--blue") ||
        classes.includes("--sent") ||
        classes.includes("--outbound")
      ) {
        direction = "outbound";
      }
    }

    // Extract timestamp
    const timeEl =
      item.querySelector("time") ||
      item.querySelector('[class*="msg-s-message-list__time-heading"]') ||
      item.querySelector('[class*="msg-s-message-group__timestamp"]');
    let sentAt = "";
    if (timeEl) {
      sentAt =
        timeEl.getAttribute("datetime") || timeEl.textContent.trim();
    }

    messages.push({ body, direction, sentAt, senderName });
  }

  return messages;
}

// ─── UI ───────────────────────────────────────────────────────

function createButton(id, text, bgColor) {
  const btn = document.createElement("button");
  btn.id = id;
  btn.textContent = text;
  Object.assign(btn.style, {
    padding: "8px 16px",
    background: bgColor,
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    transition: "all 0.2s ease",
  });
  return btn;
}

function injectToolbar() {
  if (document.getElementById(TOOLBAR_ID)) return;

  const toolbar = document.createElement("div");
  toolbar.id = TOOLBAR_ID;
  Object.assign(toolbar.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "99999",
    display: "flex",
    gap: "8px",
    alignItems: "center",
  });

  // Paste button
  const pasteBtn = createButton(PASTE_BTN_ID, "Paste Follow-up", "#7c3aed");
  pasteBtn.addEventListener("click", handlePaste);

  // Sync button
  const syncBtn = createButton(SYNC_BTN_ID, "Sync Messages", "#2563eb");
  syncBtn.addEventListener("click", handleSync);

  toolbar.appendChild(syncBtn);
  toolbar.appendChild(pasteBtn);
  document.body.appendChild(toolbar);
}

async function handlePaste() {
  const btn = document.getElementById(PASTE_BTN_ID);
  if (!btn) return;

  try {
    const text = await navigator.clipboard.readText();
    if (!text || text.trim().length === 0) {
      showButtonStatus(btn, "Clipboard empty", "#ef4444", 2000);
      return;
    }

    const composer = findComposer();
    if (!composer) {
      showButtonStatus(btn, "No composer found", "#ef4444", 3000);
      return;
    }

    composer.focus();
    composer.innerHTML = "<p>" + text.replace(/\n/g, "</p><p>") + "</p>";
    composer.dispatchEvent(new Event("input", { bubbles: true }));
    showButtonStatus(btn, "Pasted!", "#22c55e", 3000);
  } catch (err) {
    showButtonStatus(btn, "Clipboard denied", "#ef4444", 3000);
  }
}

async function handleSync() {
  const btn = document.getElementById(SYNC_BTN_ID);
  if (!btn) return;

  const convexUrl = getConvexUrl();
  if (!convexUrl) {
    showButtonStatus(
      btn,
      "Set CAREER_OPS_CONVEX_URL in localStorage",
      "#ef4444",
      5000
    );
    return;
  }

  // Get conversation partner's LinkedIn URL
  const partnerUrl = getConversationPartnerUrl();
  if (!partnerUrl) {
    showButtonStatus(btn, "Can't find contact profile", "#ef4444", 3000);
    return;
  }

  // Normalize to full URL
  const fullPartnerUrl = partnerUrl.startsWith("http")
    ? partnerUrl
    : "https://www.linkedin.com" + partnerUrl;

  showButtonStatus(btn, "Scraping...", "#f59e0b");

  const messages = scrapeMessages();
  if (messages.length === 0) {
    showButtonStatus(btn, "No messages found", "#ef4444", 3000);
    return;
  }

  showButtonStatus(btn, `Syncing ${messages.length} msgs...`, "#f59e0b");

  try {
    const response = await fetch(convexUrl + "/api/linkedin-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactLinkedinUrl: fullPartnerUrl,
        messages: messages.map((m) => ({
          body: m.body,
          direction: m.direction,
          sentAt: m.sentAt || new Date().toISOString(),
        })),
      }),
    });

    const result = await response.json();
    if (response.ok) {
      showButtonStatus(
        btn,
        `Synced ${result.synced}, skipped ${result.skipped}`,
        "#22c55e",
        4000
      );
    } else {
      showButtonStatus(
        btn,
        result.error || "Sync failed",
        "#ef4444",
        4000
      );
    }
  } catch (err) {
    showButtonStatus(btn, "Network error", "#ef4444", 4000);
  }
}

function showButtonStatus(btn, text, color, resetAfter) {
  const origText = btn.dataset.origText || btn.textContent;
  if (!btn.dataset.origText) btn.dataset.origText = origText;
  const origColor = btn.dataset.origColor || btn.style.background;
  if (!btn.dataset.origColor) btn.dataset.origColor = origColor;

  btn.textContent = text;
  btn.style.background = color;

  if (resetAfter) {
    setTimeout(() => {
      btn.textContent = origText;
      btn.style.background = origColor;
    }, resetAfter);
  }
}

// ─── Init ─────────────────────────────────────────────────────

// Wait for LinkedIn's messaging UI to settle, then inject
setTimeout(injectToolbar, 2500);

// Re-inject if navigating within LinkedIn (SPA)
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    // Remove old toolbar on navigation
    const old = document.getElementById(TOOLBAR_ID);
    if (old) old.remove();
    if (location.href.includes("/messaging/")) {
      setTimeout(injectToolbar, 2500);
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });
