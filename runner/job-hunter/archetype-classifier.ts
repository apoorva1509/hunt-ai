import Anthropic from "@anthropic-ai/sdk";
import { classifyByKeywords } from "./archetypes.js";
import type { ArchetypeId } from "./types.js";

const VALID_ARCHETYPES: ArchetypeId[] = [
  "ai_platform_llmops",
  "agentic_automation",
  "technical_ai_pm",
  "solutions_architect",
  "forward_deployed",
  "ai_transformation",
];

let anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic();
  }
  return anthropic;
}

/**
 * Classify a job into one of 6 archetypes.
 * Fast path: keyword scoring. Slow path: Claude Haiku.
 */
export async function classifyArchetype(
  jdText: string
): Promise<{ id: ArchetypeId; method: "keyword" | "llm" | "default" }> {
  // Fast path
  const keywordResult = classifyByKeywords(jdText);
  if (keywordResult.confident) {
    return { id: keywordResult.id, method: "keyword" };
  }

  // Slow path: Claude Haiku
  try {
    const client = getAnthropic();
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: `Classify this job description into exactly one archetype. Reply with ONLY the archetype ID, nothing else.

Archetypes:
- ai_platform_llmops: ML infra, model serving, training pipelines, MLOps
- agentic_automation: Autonomous agents, workflow automation, RAG, LLM apps
- technical_ai_pm: AI product management, roadmap, user research
- solutions_architect: Enterprise solutions, pre-sales, system design
- forward_deployed: Embedded engineering, rapid prototyping, customer eng
- ai_transformation: Org-wide AI adoption, strategy, change management

JD (first 2000 chars):
${jdText.slice(0, 2000)}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text.trim().toLowerCase()
        : "";

    const matched = VALID_ARCHETYPES.find((a) => text.includes(a));
    if (matched) return { id: matched, method: "llm" };
  } catch (err) {
    console.warn("[classifier] LLM classification failed:", (err as Error).message);
  }

  // Default fallback
  return { id: keywordResult.id || "agentic_automation", method: "default" };
}
