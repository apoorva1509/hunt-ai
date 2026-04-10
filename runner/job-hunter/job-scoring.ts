import Anthropic from "@anthropic-ai/sdk";
import type { ClassifiedJob, CompanyIntel, ScoreDimensions } from "./types.js";

let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

const FALLBACK_SCORES: ScoreDimensions = {
  northStar: 12,
  cvMatch: 7,
  seniority: 7,
  compensation: 5,
  growth: 5,
  remoteQuality: 3,
  reputation: 3,
  techStack: 3,
  speedToOffer: 3,
  culturalSignals: 3,
  total: 53,
};

/**
 * Score a job across 10 dimensions using Claude Haiku.
 * Returns structured scores out of 100 total.
 */
export async function scoreJob(
  job: ClassifiedJob,
  companyIntel: CompanyIntel,
  resumeText: string,
  candidatePositioning?: string
): Promise<ScoreDimensions> {
  try {
    const client = getAnthropic();
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Score this job opportunity for the candidate. Return ONLY a JSON object with these integer scores:

Dimensions (max points):
- northStar (0-25): Career direction alignment with candidate's positioning
- cvMatch (0-15): Resume-to-JD requirements match
- seniority (0-15): Level fit (too junior or too senior = low)
- compensation (0-10): Pay vs expectations (no info = 5)
- growth (0-10): Career growth potential at this company
- remoteQuality (0-5): Remote/hybrid/onsite fit for India-based candidate
- reputation (0-5): Company brand and market position value
- techStack (0-5): Technology alignment with candidate's skills
- speedToOffer (0-5): Hiring velocity signals
- culturalSignals (0-5): Culture fit indicators

CANDIDATE RESUME (first 1500 chars):
${resumeText.slice(0, 1500)}

CANDIDATE POSITIONING:
${candidatePositioning ?? "Full stack AI engineer at early-stage startups, seeking founding/senior roles"}

JOB:
Company: ${job.company}
Role: ${job.role}
Archetype: ${job.archetype}
Board: ${job.jobBoard}
${job.jdText ? `JD:\n${job.jdText.slice(0, 2000)}` : `Snippet: ${job.snippet ?? "N/A"}`}

COMPANY INTEL:
Funding: ${companyIntel.fundingStage ?? "unknown"}
AI Maturity: ${companyIntel.aiMaturity}
Pain Points: ${companyIntel.painPoints.slice(0, 3).join("; ")}
Tech Stack: ${companyIntel.techStack.join(", ")}
Market Position: ${companyIntel.marketPosition}

Return ONLY valid JSON: {"northStar":N,"cvMatch":N,"seniority":N,"compensation":N,"growth":N,"remoteQuality":N,"reputation":N,"techStack":N,"speedToOffer":N,"culturalSignals":N}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return FALLBACK_SCORES;

    const scores = JSON.parse(jsonMatch[0]) as Omit<ScoreDimensions, "total">;
    const total =
      (scores.northStar ?? 0) +
      (scores.cvMatch ?? 0) +
      (scores.seniority ?? 0) +
      (scores.compensation ?? 0) +
      (scores.growth ?? 0) +
      (scores.remoteQuality ?? 0) +
      (scores.reputation ?? 0) +
      (scores.techStack ?? 0) +
      (scores.speedToOffer ?? 0) +
      (scores.culturalSignals ?? 0);

    return { ...scores, total };
  } catch (err) {
    console.warn("[scoring] LLM scoring failed:", (err as Error).message);
    return FALLBACK_SCORES;
  }
}
