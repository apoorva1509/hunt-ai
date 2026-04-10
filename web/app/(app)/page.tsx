"use client";

import { useAgent } from "@/components/providers/agent-provider";
import { useJobLeads } from "@/hooks/use-agent-items";
import { useLatestRun } from "@/hooks/use-agent-runs";
import { Briefcase, Users, Send, Zap, Play } from "lucide-react";
import { useAgentItems } from "@/hooks/use-agent-items";

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-900">
        <Icon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
      </div>
      <div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-sm text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { activeAgent, isLoading: agentLoading } = useAgent();
  const leads = useJobLeads();
  const contacts = useAgentItems("contact");
  const drafts = useAgentItems("outreach_draft");
  const latestRun = useLatestRun();

  if (agentLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (!activeAgent) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-semibold">Welcome to Career Ops</h2>
        <p className="text-zinc-500">
          Create an agent in Settings to get started.
        </p>
      </div>
    );
  }

  const highScoreLeads =
    leads?.filter((l: any) => l.data.matchScore >= 80).length ?? 0;
  const pendingDrafts =
    drafts?.filter((d: any) => d.status === "new").length ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-zinc-500">
            Agent: {activeAgent.name} ({activeAgent.type})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/pipeline"
            className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            <Play className="h-4 w-4" />
            Pipeline
          </a>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Job Leads"
          value={leads?.length ?? 0}
          icon={Briefcase}
        />
        <StatCard
          label="High Score (80+)"
          value={highScoreLeads}
          icon={Zap}
        />
        <StatCard
          label="Contacts"
          value={contacts?.length ?? 0}
          icon={Users}
        />
        <StatCard
          label="Pending Drafts"
          value={pendingDrafts}
          icon={Send}
        />
      </div>

      {/* Latest run status */}
      {latestRun && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="mb-2 text-sm font-medium text-zinc-500">
            Latest Run
          </h3>
          <div className="flex items-center gap-4">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                latestRun.status === "completed"
                  ? "bg-green-100 text-green-800"
                  : latestRun.status === "running"
                    ? "bg-blue-100 text-blue-800"
                    : latestRun.status === "failed"
                      ? "bg-red-100 text-red-800"
                      : "bg-zinc-100 text-zinc-800"
              }`}
            >
              {latestRun.status}
            </span>
            {latestRun.summary && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {latestRun.summary}
              </p>
            )}
            {latestRun.error && (
              <p className="text-sm text-red-600">{latestRun.error}</p>
            )}
          </div>
        </div>
      )}

      {/* Recent leads */}
      {leads && leads.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
            <h3 className="font-medium">Recent Leads</h3>
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {leads.slice(0, 5).map((lead: any) => (
              <div
                key={lead._id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div>
                  <p className="font-medium">{lead.title}</p>
                  <p className="text-sm text-zinc-500">{lead.data.archetype}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold ${
                      lead.data.matchScore >= 80
                        ? "text-green-600"
                        : lead.data.matchScore >= 60
                          ? "text-amber-600"
                          : "text-zinc-500"
                    }`}
                  >
                    {lead.data.matchScore}/100
                  </span>
                  <span className="text-xs text-zinc-400">{lead.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
