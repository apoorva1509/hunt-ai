import type { LeadItem, CompanyGroup, StatusFilter } from "./types";
import { BORDER_COLORS } from "./types";

export function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

export function scoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-50 dark:bg-emerald-900/20";
  if (score >= 60) return "bg-amber-50 dark:bg-amber-900/20";
  return "bg-red-50 dark:bg-red-900/20";
}

export function formatSalary(
  salary?: number,
  compensationRange?: {
    min?: number;
    max?: number;
    currency: string;
  }
): string | null {
  if (compensationRange?.min || compensationRange?.max) {
    const cur = compensationRange.currency ?? "$";
    const fmt = (n: number) =>
      n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;
    if (compensationRange.min && compensationRange.max) {
      return `${cur} ${fmt(compensationRange.min)}-${fmt(compensationRange.max)}`;
    }
    return `${cur} ${fmt(compensationRange.min ?? compensationRange.max!)}+`;
  }
  if (salary) return `$${Math.round(salary / 1000)}k`;
  return null;
}

export function groupLeadsByCompany(
  leads: LeadItem[],
  minScore: number,
  statusFilter: StatusFilter
): CompanyGroup[] {
  const filtered = leads.filter(
    (l) =>
      l.data.matchScore >= minScore &&
      (statusFilter === "all" || l.status === statusFilter)
  );

  const groups = new Map<string, LeadItem[]>();
  for (const lead of filtered) {
    const company = lead.data.company || "Unknown";
    const existing = groups.get(company) ?? [];
    existing.push(lead);
    groups.set(company, existing);
  }

  const result: CompanyGroup[] = [];
  for (const [name, companyLeads] of groups) {
    const sorted = companyLeads.sort(
      (a, b) => b.data.matchScore - a.data.matchScore
    );
    const best = sorted[0].data;

    // Collect unique work modes and primary location
    const workModes = [
      ...new Set(
        companyLeads
          .map((l) => l.data.workMode)
          .filter((w) => !!w && w !== "unknown")
      ),
    ];
    const location =
      companyLeads.find((l) => l.data.location)?.data.location ?? undefined;

    result.push({
      name,
      leads: sorted,
      bestScore: best.matchScore,
      fundingStage: best.fundingStage,
      archetype: best.archetype,
      description:
        best.corePain || best.matchReason || buildDescription(best),
      location,
      workModes,
    });
  }

  return result.sort((a, b) => b.bestScore - a.bestScore);
}

function buildDescription(data: LeadItem["data"]): string {
  const parts: string[] = [];
  if (data.fundingStage) parts.push(data.fundingStage);
  if (data.techStack?.length > 0)
    parts.push(`Tech: ${data.techStack.slice(0, 5).join(", ")}`);
  if (data.aiGap) parts.push(data.aiGap);
  return parts.join(" | ") || "No description available";
}

export function getBorderColor(index: number): string {
  return BORDER_COLORS[index % BORDER_COLORS.length];
}

export function countByStatus(
  leads: LeadItem[]
): Record<string, number> {
  const counts: Record<string, number> = { all: leads.length };
  for (const l of leads) {
    counts[l.status] = (counts[l.status] ?? 0) + 1;
  }
  return counts;
}
