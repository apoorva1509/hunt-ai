/**
 * Phase 7: Pain Map Synthesis + Phase 8: Outreach Generation
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  ClassifiedJob,
  CompanyIntel,
  DecisionMaker,
  PainMap,
  OutreachSet,
  OutreachStrategy,
  LinkedInOutreach,
  EmailOutreach,
  WhatsAppOutreach,
} from "./types.js";

let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

const BANNED_PHRASES = [
  "I came across your profile",
  "I noticed",
  "I was impressed",
  "I'd love to",
  "hope this finds you well",
  "quick question",
  "I'm passionate about",
  "I believe I could",
  "just wanted to",
  "would love to",
  "I wanted to reach out",
  "sorry to bother you",
  "I love what",
  "I think I'd be a good fit",
];

// WhatsApp is inappropriate for US/Canada targets
const NO_WHATSAPP_COUNTRIES = new Set(["US", "CA"]);

// ── Phase 7: Pain Map Synthesis ──────────────────────────────

export async function synthesizePainMap(
  job: ClassifiedJob,
  companyIntel: CompanyIntel,
  resumeText: string
): Promise<PainMap> {
  try {
    const client = getAnthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content: `You are mapping a candidate's resume to a company's acute pain. Be brutally honest.

COMPANY: ${companyIntel.name}
Pain Points: ${companyIntel.painPoints.join("; ")}
Funding: ${companyIntel.fundingStage ?? "unknown"}
AI Maturity: ${companyIntel.aiMaturity}
Market Position: ${companyIntel.marketPosition}

JOB: ${job.role} (${job.archetype})
${job.jdText ? `JD:\n${job.jdText.slice(0, 1500)}` : `Snippet: ${job.snippet ?? "N/A"}`}

CANDIDATE RESUME (first 1200 chars):
${resumeText.slice(0, 1200)}

Return ONLY valid JSON:
{
  "corePain": "1-2 sentences - THE deepest unmet need RIGHT NOW",
  "urgencySignal": "WHY NOW - recent funding, launch, competitor move",
  "aiGap": "Specific AI/ML gap this candidate fills",
  "matchScore": 0-100,
  "matchReason": "2-3 sentences mapping resume to pain"
}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.warn("[painmap] Synthesis failed:", (err as Error).message);
  }

  return {
    corePain: "Unable to synthesize",
    urgencySignal: "Unknown",
    aiGap: "Unknown",
    matchScore: 50,
    matchReason: "LLM synthesis failed, review manually",
  };
}

// ── Phase 8: Outreach Generation ─────────────────────────────

export async function generateOutreach(
  dm: DecisionMaker,
  painMap: PainMap,
  strategy: OutreachStrategy | null,
  resumeText: string,
  channels: Array<"linkedin" | "email" | "whatsapp">,
  targetCountry?: string
): Promise<OutreachSet> {
  const client = getAnthropic();
  const result: OutreachSet = {};

  // Filter out WhatsApp for US/Canada
  const filteredChannels = channels.filter(
    (ch) => ch !== "whatsapp" || !NO_WHATSAPP_COUNTRIES.has(targetCountry ?? "")
  );

  for (const channel of filteredChannels) {
    try {
      const messages = await generateChannelOutreach(
        client,
        dm,
        painMap,
        strategy,
        resumeText,
        channel
      );

      if (channel === "linkedin") result.linkedin = messages as LinkedInOutreach;
      if (channel === "email") result.email = messages as EmailOutreach;
      if (channel === "whatsapp") result.whatsapp = messages as WhatsAppOutreach;
    } catch (err) {
      console.warn(
        `[outreach] ${channel} generation failed for ${dm.name}:`,
        (err as Error).message
      );
    }
  }

  if (strategy) result.strategyId = strategy._id;
  return result;
}

async function generateChannelOutreach(
  client: Anthropic,
  dm: DecisionMaker,
  painMap: PainMap,
  strategy: OutreachStrategy | null,
  resumeText: string,
  channel: "linkedin" | "email" | "whatsapp"
): Promise<LinkedInOutreach | EmailOutreach | WhatsAppOutreach> {
  const channelSpec = getChannelSpec(channel);

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `Generate hyper-personalized ${channel} outreach.

RULES (CRITICAL):
- NEVER open with "I" as first word
- You:I pronoun ratio must be >= 2:1
- Reading level <= 5th grade
- Each paragraph <= 2 lines on mobile (~120 chars)
- Single CTA only
- Include "because" trigger near ask
- Close with BYAF phrase ("No pressure" / "Completely understand if not")
- BANNED phrases: ${BANNED_PHRASES.join(", ")}

SENDER RESUME (first 1200 chars):
${resumeText.slice(0, 1200)}

RECIPIENT:
Name: ${dm.name}
Title: ${dm.title}
Company: ${dm.company}
${dm.headline ? `Headline: ${dm.headline}` : ""}
${dm.recentFocus ? `Recent Focus: ${dm.recentFocus}` : ""}
${dm.publicContent.length > 0 ? `Public Content: ${dm.publicContent.slice(0, 3).join("; ")}` : ""}
${dm.recentActivity.length > 0 ? `Recent Activity: ${dm.recentActivity.slice(0, 3).join("; ")}` : ""}

COMPANY CONTEXT:
Core Pain: ${painMap.corePain}
Urgency: ${painMap.urgencySignal}
AI Gap: ${painMap.aiGap}
Match Reason: ${painMap.matchReason}

${strategy ? `STRATEGY:\nAngle: ${strategy.angle}\nNotes: ${strategy.templateNotes}` : ""}

${channelSpec.prompt}

Return ONLY valid JSON matching this exact structure:
${channelSpec.jsonTemplate}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");
  return JSON.parse(jsonMatch[0]);
}

interface ChannelSpec {
  prompt: string;
  jsonTemplate: string;
}

function getChannelSpec(channel: "linkedin" | "email" | "whatsapp"): ChannelSpec {
  switch (channel) {
    case "linkedin":
      return {
        prompt: `LINKEDIN FORMAT:
- connectionRequest: <= 300 chars (200 ideal for free accounts). Hook + why + soft ask.
- followUpDm: <= 120 words. Sent 24-48h after they accept. Reference their specific work.
- followUpNudge: day 5-6, 1-2 sentences, add NEW value (article, insight, relevant news).`,
        jsonTemplate: `{"connectionRequest":"...","followUpDm":"...","followUpNudge":"..."}`,
      };
    case "email":
      return {
        prompt: `EMAIL FORMAT:
- emailSubject: <= 50 chars, lowercase preferred, 1-3 words optimal. No spam triggers.
- emailBody: 75-100 words, plain text. Hook about THEIR problem, bridge to YOUR value, CTA.
- emailPS: 1-2 sentences. Your single strongest signal (metric, shared connection, specific insight).
- followUp1: day 5. 1-2 sentences. NEW value — article, data point, competitor move.
- breakupEmail: day 12-14. Graceful exit. Short. Leave door open.`,
        jsonTemplate: `{"emailSubject":"...","emailBody":"...","emailPS":"...","followUp1":"...","breakupEmail":"..."}`,
      };
    case "whatsapp":
      return {
        prompt: `WHATSAPP FORMAT:
- whatsappMessage: <= 100 words. Casual and warm. Like texting a friend-of-friend.
- whatsappFollowUp: day 3-4. ONE line only. Max 1 follow-up ever.`,
        jsonTemplate: `{"whatsappMessage":"...","whatsappFollowUp":"..."}`,
      };
  }
}
