import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const channelValidator = v.union(
  v.literal("connection_request"),
  v.literal("first_message"),
  v.literal("email"),
  v.literal("whatsapp")
);

const CHANNEL_PROMPTS: Record<string, { system: string; maxChars?: number }> = {
  connection_request: {
    system: `You write LinkedIn connection request messages. They must be under 300 characters, warm but professional, mention a specific shared interest or reason for connecting. No generic "I'd love to connect" messages. Be concise and genuine.`,
    maxChars: 300,
  },
  first_message: {
    system: `You write LinkedIn DMs for people who are already connected. The message should be conversational, reference something specific about the person or their company, and naturally lead to expressing interest in working together. Keep it under 500 characters.`,
    maxChars: 500,
  },
  email: {
    system: `You write professional outreach emails. Include a compelling subject line on the first line (format: "Subject: ..."), followed by the email body. Be specific about why you're reaching out, reference their company's work, and include a clear but low-pressure call to action. Keep it under 200 words.`,
  },
  whatsapp: {
    system: `You write short, casual WhatsApp messages for professional outreach. Keep it friendly and brief — 2-3 sentences max. No formality, no "Dear Sir/Madam". Just a quick, genuine message that feels natural for WhatsApp.`,
    maxChars: 300,
  },
};

export const generate: ReturnType<typeof action> = action({
  args: {
    contactId: v.id("agentItems"),
    leadId: v.id("agentItems"),
    channel: channelValidator,
  },
  handler: async (ctx, { contactId, leadId, channel }) => {
    // Read contact and lead data
    const contact = await ctx.runQuery(api.agentItems.getItem, { id: contactId });
    const lead = await ctx.runQuery(api.agentItems.getItem, { id: leadId });
    if (!contact || !lead) throw new Error("Contact or lead not found");

    const contactData = contact.data as Record<string, any>;
    const leadData = lead.data as Record<string, any>;

    // Get Anthropic API key from secrets
    const apiKey = await ctx.runAction(api.secrets.getSecret, {
      agentId: lead.agentId,
      key: "ANTHROPIC_API_KEY",
    });
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not found in secrets");

    const channelConfig = CHANNEL_PROMPTS[channel];
    const prompt = buildPrompt(contactData, leadData, channel);

    // Call Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: channelConfig.system,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} — ${error}`);
    }

    const result = await response.json();
    const content =
      result.content?.[0]?.text ?? "Failed to generate outreach";

    // Parse email subject if applicable
    let subject: string | undefined;
    let body = content;
    if (channel === "email") {
      const subjectMatch = content.match(/^Subject:\s*(.+)\n/);
      if (subjectMatch) {
        subject = subjectMatch[1].trim();
        body = content.replace(/^Subject:\s*.+\n\n?/, "").trim();
      }
    }

    // Create the outreach_draft item
    const draftId = await ctx.runMutation(api.agentItems.createItem, {
      agentId: lead.agentId,
      parentId: contactId,
      type: "outreach_draft" as any,
      title:
        channel === "email"
          ? `Email: ${subject ?? "Outreach"}`
          : channel === "connection_request"
            ? "Connection Request"
            : channel === "first_message"
              ? "First Message"
              : "WhatsApp Message",
      subtitle: `${body.length} chars`,
      data: {
        channel:
          channel === "connection_request" || channel === "first_message"
            ? "linkedin"
            : channel,
        body,
        subject,
        charCount: body.length,
        approvalRequired: true,
      },
      actions: ["approve", "edit", "skip"],
    });

    return { draftId, body, subject, charCount: body.length };
  },
});

function buildPrompt(
  contact: Record<string, any>,
  lead: Record<string, any>,
  channel: string
): string {
  const lines = [
    `Generate a ${channel.replace(/_/g, " ")} message.`,
    "",
    `RECIPIENT:`,
    `- Name: ${contact.name}`,
    `- Title: ${contact.title}`,
    contact.headline ? `- Headline: ${contact.headline}` : "",
    contact.recentFocus ? `- Recent focus: ${contact.recentFocus}` : "",
    "",
    `COMPANY: ${lead.company}`,
    lead.fundingStage ? `- Stage: ${lead.fundingStage}` : "",
    lead.corePain ? `- Core pain: ${lead.corePain}` : "",
    lead.matchReason ? `- Why I'm a fit: ${lead.matchReason}` : "",
    "",
    `ROLE: ${lead.role}`,
    lead.archetype ? `- Type: ${lead.archetype.replace(/_/g, " ")}` : "",
    "",
    `Write ONLY the message text. No explanations, no options, no "[Your Name]" placeholders.`,
  ];
  return lines.filter(Boolean).join("\n");
}
