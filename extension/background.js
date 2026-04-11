// Background service worker — handles network requests to bypass LinkedIn CSP

const CONVEX_URL = "https://steady-opossum-661.convex.site";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "CAREER_OPS_SYNC") return false;

  fetch(CONVEX_URL + "/api/linkedin-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message.payload),
  })
    .then((r) => r.json())
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));

  return true; // keeps the message channel open for async sendResponse
});
