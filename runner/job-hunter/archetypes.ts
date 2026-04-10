import type { ArchetypeId } from "./types.js";

interface ArchetypeDefinition {
  id: ArchetypeId;
  label: string;
  keywords: string[];
}

export const ARCHETYPES: ArchetypeDefinition[] = [
  {
    id: "ai_platform_llmops",
    label: "AI Platform / LLMOps",
    keywords: [
      "ml infrastructure", "model serving", "training pipeline", "gpu cluster",
      "mlops", "llmops", "model deployment", "inference", "fine-tuning",
      "model monitoring", "feature store", "data pipeline", "ml platform",
      "model registry", "experiment tracking", "kubeflow", "mlflow",
      "sagemaker", "vertex ai", "model optimization", "quantization",
      "distributed training", "ray", "vllm", "triton", "tensorrt",
    ],
  },
  {
    id: "agentic_automation",
    label: "Agentic / Automation",
    keywords: [
      "agent", "agentic", "autonomous", "workflow automation", "multi-agent",
      "tool use", "function calling", "langchain", "langgraph", "autogen",
      "crew ai", "orchestration", "hitl", "human in the loop", "rag",
      "retrieval augmented", "vector database", "embedding", "semantic search",
      "chatbot", "conversational ai", "prompt engineering", "llm application",
      "ai assistant", "copilot", "ai-powered", "generative ai",
    ],
  },
  {
    id: "technical_ai_pm",
    label: "Technical AI PM",
    keywords: [
      "product manager", "product management", "prd", "roadmap", "discovery",
      "stakeholder", "user research", "a/b testing", "product strategy",
      "go-to-market", "gtm", "product-led", "plg", "metrics", "okr",
      "prioritization", "backlog", "sprint", "agile", "scrum",
    ],
  },
  {
    id: "solutions_architect",
    label: "AI Solutions Architect",
    keywords: [
      "solutions architect", "enterprise", "integration", "pre-sales",
      "technical sales", "poc", "proof of concept", "architecture",
      "system design", "consulting", "advisory", "client-facing",
      "implementation", "deployment", "migration", "cloud architecture",
      "aws", "gcp", "azure", "infrastructure",
    ],
  },
  {
    id: "forward_deployed",
    label: "AI Forward Deployed",
    keywords: [
      "forward deployed", "field engineer", "customer engineering",
      "rapid prototyping", "fast delivery", "embedded", "on-site",
      "customer success", "technical account", "implementation engineer",
      "professional services", "custom solutions", "bespoke",
    ],
  },
  {
    id: "ai_transformation",
    label: "AI Transformation",
    keywords: [
      "transformation", "change management", "adoption", "enablement",
      "digital transformation", "ai strategy", "ai governance",
      "responsible ai", "ai ethics", "organizational change",
      "training", "upskilling", "center of excellence", "coe",
    ],
  },
];

const MIN_CONFIDENT_SCORE = 3;
const MIN_CONFIDENCE_RATIO = 1.5;

/**
 * Fast keyword-based archetype classification.
 * Returns the archetype if confident, null if ambiguous (needs LLM).
 */
export function classifyByKeywords(
  text: string
): { id: ArchetypeId; confident: boolean } {
  const lower = text.toLowerCase();
  const scores: Array<{ id: ArchetypeId; score: number }> = [];

  for (const arch of ARCHETYPES) {
    let score = 0;
    for (const kw of arch.keywords) {
      if (lower.includes(kw)) score++;
    }
    scores.push({ id: arch.id, score });
  }

  scores.sort((a, b) => b.score - a.score);
  const [first, second] = scores;

  if (
    first.score >= MIN_CONFIDENT_SCORE &&
    first.score > second.score * MIN_CONFIDENCE_RATIO
  ) {
    return { id: first.id, confident: true };
  }

  return { id: first.score > 0 ? first.id : "agentic_automation", confident: false };
}
