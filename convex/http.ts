import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

/**
 * Receive LinkedIn messages from the Chrome extension.
 * POST /api/linkedin-sync
 * Body: { contactLinkedinUrl: string, messages: Array<{ body, direction, sentAt }> }
 */
http.route({
  path: "/api/linkedin-sync",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // CORS headers for extension
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    const body = await request.json();
    const { contactLinkedinUrl, messages } = body as {
      contactLinkedinUrl: string;
      messages: Array<{
        body: string;
        direction: "outbound" | "inbound";
        sentAt: string; // ISO date string or relative like "2d ago"
      }>;
    };

    if (!contactLinkedinUrl || !messages?.length) {
      return new Response(
        JSON.stringify({ error: "Missing contactLinkedinUrl or messages" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Find contact by LinkedIn URL
    const allContacts = await ctx.runQuery(api.outreachContacts.listAll, {});
    const contact = allContacts.find((c: any) => {
      if (!c.linkedinUrl) return false;
      // Normalize URLs for comparison (remove trailing slashes, www, etc.)
      const normalize = (url: string) =>
        url
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .replace(/\/+$/, "");
      return normalize(c.linkedinUrl) === normalize(contactLinkedinUrl);
    });

    if (!contact) {
      return new Response(
        JSON.stringify({
          error: "Contact not found",
          contactLinkedinUrl,
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Get existing messages for dedup
    const existingMessages = await ctx.runQuery(
      api.outreachMessages.listByContact,
      { contactId: contact._id }
    );

    let synced = 0;
    let skipped = 0;

    for (const msg of messages) {
      const sentAt = parseTimestamp(msg.sentAt);
      const bodyTrimmed = msg.body.trim().slice(0, 500);

      // Dedup: check if a message with similar body and time already exists
      const isDuplicate = existingMessages.some((existing: any) => {
        const timeDiff = Math.abs(existing.sentAt - sentAt);
        const bodyMatch =
          existing.body.trim().slice(0, 100) === bodyTrimmed.slice(0, 100);
        return bodyMatch && timeDiff < 24 * 60 * 60 * 1000; // within 24h
      });

      if (isDuplicate) {
        skipped++;
        continue;
      }

      await ctx.runMutation(api.outreachMessages.create, {
        contactId: contact._id,
        companyId: contact.companyId,
        channel:
          msg.direction === "outbound" ? "linkedin_dm" : "linkedin_dm",
        body: bodyTrimmed,
        sentAt,
        direction: msg.direction,
      });
      synced++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        contactName: contact.name,
        synced,
        skipped,
      }),
      { status: 200, headers: corsHeaders }
    );
  }),
});

// CORS preflight
http.route({
  path: "/api/linkedin-sync",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

function parseTimestamp(raw: string): number {
  // Try ISO date first
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.getTime();

  // Try relative formats like "2d ago", "3h ago"
  const match = raw.match(/(\d+)\s*(d|h|m|min|hr|day|hour|minute)/i);
  if (match) {
    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const now = Date.now();
    if (unit.startsWith("d")) return now - num * 86400000;
    if (unit.startsWith("h")) return now - num * 3600000;
    if (unit.startsWith("m")) return now - num * 60000;
  }

  // Fallback to now
  return Date.now();
}

export default http;
