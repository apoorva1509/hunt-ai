// Career Ops - LinkedIn Paste Extension
// Injects a floating "Paste Follow-up" button on LinkedIn messaging pages.
// The Career Ops web app copies the follow-up message to clipboard before
// opening LinkedIn, so this button just reads clipboard and pastes.

const BUTTON_ID = "career-ops-paste-btn";

function findComposer() {
  return (
    document.querySelector(
      'div.msg-form__contenteditable[contenteditable="true"]'
    ) || document.querySelector('div[role="textbox"][contenteditable="true"]')
  );
}

function injectPasteButton() {
  if (document.getElementById(BUTTON_ID)) return;

  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.textContent = "Paste Follow-up";
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "99999",
    padding: "10px 20px",
    background: "#7c3aed",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(124, 58, 237, 0.4)",
    transition: "all 0.2s ease",
  });

  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#6d28d9";
    btn.style.transform = "translateY(-1px)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "#7c3aed";
    btn.style.transform = "translateY(0)";
  });

  btn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.trim().length === 0) {
        btn.textContent = "Clipboard empty";
        btn.style.background = "#ef4444";
        setTimeout(() => btn.remove(), 2000);
        return;
      }

      const composer = findComposer();
      if (!composer) {
        btn.textContent = "No composer found";
        btn.style.background = "#ef4444";
        setTimeout(() => {
          btn.textContent = "Paste Follow-up";
          btn.style.background = "#7c3aed";
        }, 3000);
        return;
      }

      composer.focus();
      composer.innerHTML =
        "<p>" + text.replace(/\n/g, "</p><p>") + "</p>";
      composer.dispatchEvent(new Event("input", { bubbles: true }));

      btn.textContent = "Pasted! Review and send.";
      btn.style.background = "#22c55e";
      setTimeout(() => btn.remove(), 3000);
    } catch (err) {
      btn.textContent = "Clipboard access denied";
      btn.style.background = "#ef4444";
      setTimeout(() => btn.remove(), 3000);
    }
  });

  document.body.appendChild(btn);
}

// Wait for LinkedIn's messaging UI to settle, then inject
setTimeout(injectPasteButton, 2500);

// Re-inject if navigating within LinkedIn (SPA)
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    if (location.href.includes("/messaging/")) {
      setTimeout(injectPasteButton, 2500);
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });
