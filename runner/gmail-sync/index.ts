/**
 * Gmail Sync Runner
 *
 * This script is designed to be run via Claude Code with Gmail MCP tools available.
 * It syncs sent emails and detects replies from outreach contacts.
 *
 * Usage:
 *   - Run manually: `npx tsx runner/gmail-sync/index.ts`
 *   - Or via Claude Code which has Gmail MCP access
 *
 * Environment variables:
 *   - CONVEX_URL: Convex deployment URL
 *
 * Note: Gmail MCP operations (reading emails, creating drafts) must be performed
 * by Claude Code. This script handles the Convex side of the sync.
 * The workflow is:
 *   1. Claude Code reads Gmail via MCP -> gets email data
 *   2. This script matches emails to contacts -> creates outreachMessages
 *   3. Claude Code creates drafts via MCP when requested
 */

import {
  listAllContacts,
  createMessage,
  checkGmailMessageExists,
} from "./convex-client.js";

interface GmailEmail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: number;
}

/**
 * Sync a batch of emails from Gmail to outreachMessages.
 * Called by Claude Code after fetching emails via Gmail MCP.
 */
export async function syncEmails(
  emails: GmailEmail[],
  direction: "outbound" | "inbound"
) {
  const contacts = await listAllContacts();
  const contactsByEmail = new Map<string, (typeof contacts)[0]>();
  for (const contact of contacts) {
    if (contact.email) {
      contactsByEmail.set(contact.email.toLowerCase(), contact);
    }
  }

  let synced = 0;
  let skipped = 0;

  for (const email of emails) {
    const matchEmail = direction === "outbound" ? email.to : email.from;
    const normalizedEmail = matchEmail.toLowerCase().trim();
    // Extract email from "Name <email@example.com>" format
    const emailMatch = normalizedEmail.match(/<([^>]+)>/) ?? [
      null,
      normalizedEmail,
    ];
    const cleanEmail = emailMatch[1] ?? normalizedEmail;

    const contact = contactsByEmail.get(cleanEmail);
    if (!contact) {
      skipped++;
      continue;
    }

    const exists = await checkGmailMessageExists(email.id);
    if (exists) {
      skipped++;
      continue;
    }

    await createMessage({
      contactId: contact._id,
      companyId: contact.companyId,
      channel: "email",
      body: email.body,
      sentAt: email.date,
      direction,
      gmailMessageId: email.id,
      gmailThreadId: email.threadId,
    });
    synced++;
  }

  console.log(`Sync complete: ${synced} emails synced, ${skipped} skipped`);
  return { synced, skipped };
}

/**
 * Get contact email addresses for Gmail search queries.
 * Claude Code can use this to construct Gmail MCP queries.
 */
export async function getContactEmails(): Promise<string[]> {
  const contacts = await listAllContacts();
  return contacts.filter((c) => c.email).map((c) => c.email!);
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Gmail sync runner ready.");
  console.log(
    "This script provides sync functions for Claude Code to call."
  );
  getContactEmails().then((emails) => {
    console.log(`Tracking ${emails.length} contact emails:`);
    for (const email of emails) {
      console.log(`  - ${email}`);
    }
  });
}
