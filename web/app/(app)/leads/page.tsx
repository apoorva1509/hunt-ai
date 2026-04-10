"use client";

import { useState } from "react";
import { useAgent } from "@/components/providers/agent-provider";
import { useJobLeads } from "@/hooks/use-agent-items";
import { LeadCard } from "./lead-card";

export default function LeadsPage() {
  const { activeAgent } = useAgent();
  const leads = useJobLeads();
  const [minScore, setMinScore] = useState(0);

  if (!activeAgent) {
    return <p className="text-zinc-500">Select an agent first.</p>;
  }

  if (leads === undefined) {
    return <p className="text-zinc-500">Loading leads...</p>;
  }

  const filtered = leads
    .filter((l: any) => l.data.matchScore >= minScore)
    .sort((a: any, b: any) => b.data.matchScore - a.data.matchScore);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Job Leads ({filtered.length})
        </h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-500">Min Score:</label>
          <input
            type="range"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-32"
          />
          <span className="w-6 text-right text-sm font-medium">{minScore}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          No leads found. Run the pipeline to discover jobs.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead: any) => (
            <LeadCard key={lead._id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  );
}
