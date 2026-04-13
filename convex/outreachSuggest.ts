import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const suggestFollowUp = action({
  args: {
    contactId: v.id("outreachContacts"),
    companyId: v.id("outreachCompanies"),
    agentId: v.id("agents"),
    preferredChannel: v.optional(
      v.union(
        v.literal("linkedin"),
        v.literal("email"),
        v.literal("whatsapp")
      )
    ),
  },
  handler: async (ctx, { contactId, companyId, agentId, preferredChannel }): Promise<{ channel: string; message: string; reasoning: string }> => {
    const [contact, company, messages, companyMessages, steps, guidance] =
      await Promise.all([
        ctx.runQuery(api.outreachContacts.get, { id: contactId }),
        ctx.runQuery(api.outreachCompanies.get, { id: companyId }),
        ctx.runQuery(api.outreachMessages.listByContact, { contactId }),
        ctx.runQuery(api.outreachMessages.listByCompany, { companyId }),
        ctx.runQuery(api.outreachSteps.listByCompany, { companyId }),
        ctx.runQuery(api.outreachGuidance.listByContact, { contactId }),
      ]);

    if (!contact || !company) throw new Error("Contact or company not found");

    const apiKey = await ctx.runAction(api.secrets.getSecret, {
      agentId,
      key: "ANTHROPIC_API_KEY",
    });
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not found in agent secrets");

    const prompt = buildFollowUpPrompt({
      contact,
      company,
      contactMessages: messages,
      allCompanyMessages: companyMessages,
      steps,
      guidance,
      preferredChannel,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: `You are an expert at writing follow-up messages for job seekers. You write concise, genuine, non-pushy messages. You never use generic phrases like "I hope this finds you well". You always reference specific context from prior conversations. Output ONLY valid JSON with these fields: { "channel": "linkedin" | "email" | "whatsapp", "message": "the draft message", "reasoning": "1-2 sentence explanation of why this approach" }`,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} — ${error}`);
    }

    const result = await response.json();
    const text = result.content?.[0]?.text ?? "{}";

    try {
      return JSON.parse(text);
    } catch {
      return {
        channel: preferredChannel ?? "linkedin",
        message: text,
        reasoning: "Could not parse structured response",
      };
    }
  },
});

function buildFollowUpPrompt(ctx: {
  contact: any;
  company: any;
  contactMessages: any[];
  allCompanyMessages: any[];
  steps: any[];
  guidance: any[];
  preferredChannel?: string;
}): string {
  const {
    contact,
    company,
    contactMessages,
    allCompanyMessages,
    steps,
    guidance,
    preferredChannel,
  } = ctx;

  const lastMessage = contactMessages[0];
  const daysSinceLastMessage = lastMessage
    ? Math.floor((Date.now() - lastMessage.sentAt) / (1000 * 60 * 60 * 24))
    : null;

  const otherMessages = allCompanyMessages.filter(
    (m: any) => m.contactId !== contact._id
  );

  const channelGuidance = guidance.find(
    (g: any) => g.channel === (preferredChannel ?? "linkedin")
  );

  const lines = [
    "Generate a follow-up message for this job search outreach.",
    "",
    "CONTACT:",
    `- Name: ${contact.name}`,
    contact.title ? `- Title: ${contact.title}` : "",
    contact.headline ? `- Headline: ${contact.headline}` : "",
    "",
    "COMPANY:",
    `- Name: ${company.name}`,
    company.isYcBacked ? "- YC-backed" : "",
    company.roleAppliedFor
      ? `- Role I'm targeting: ${company.roleAppliedFor}`
      : "",
    company.description ? `- About: ${company.description}` : "",
    "",
    "PIPELINE STATUS:",
    ...steps.map(
      (s: any) => `- [${s.status === "done" ? "x" : " "}] ${s.label}`
    ),
    "",
    "MESSAGE HISTORY WITH THIS CONTACT:",
    ...(contactMessages.length > 0
      ? contactMessages.map(
          (m: any) =>
            `- [${new Date(m.sentAt).toLocaleDateString()}] [${m.channel}] [${m.direction}]: ${m.body.slice(0, 200)}`
        )
      : ["No messages yet."]),
    "",
    daysSinceLastMessage !== null
      ? `Days since last message: ${daysSinceLastMessage}`
      : "",
    "",
    otherMessages.length > 0
      ? [
          "MESSAGES TO OTHER CONTACTS AT THIS COMPANY:",
          ...otherMessages
            .slice(0, 5)
            .map(
              (m: any) =>
                `- [${new Date(m.sentAt).toLocaleDateString()}] [${m.channel}]: ${m.body.slice(0, 150)}`
            ),
        ].join("\n")
      : "",
    "",
    channelGuidance
      ? `GUIDANCE FOR THIS CHANNEL: ${channelGuidance.guidance}`
      : "",
    preferredChannel
      ? `PREFERRED CHANNEL: ${preferredChannel}`
      : "Choose the best channel based on context.",
    "",
    "Write ONLY the JSON response. No explanations outside the JSON.",
  ];

  return lines.filter((l) => l !== "").join("\n");
}
