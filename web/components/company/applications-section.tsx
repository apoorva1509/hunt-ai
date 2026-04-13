"use client";

import { Briefcase, ExternalLink } from "lucide-react";
import type { JobLeadData } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  actioned: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  done: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  skipped: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};

interface ApplicationsSectionProps {
  leads: any[];
}

export function ApplicationsSection({ leads }: ApplicationsSectionProps) {
  if (leads.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Briefcase className="h-4 w-4" />
          Applications
        </h3>
        <p className="text-sm text-zinc-500">No applications yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Briefcase className="h-4 w-4" />
        Applications ({leads.length})
      </h3>
      <div className="space-y-2">
        {leads.map((lead: any) => {
          const d = lead.data as JobLeadData;
          return (
            <div
              key={lead._id}
              className="flex items-center justify-between rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
            >
              <div>
                <p className="text-sm font-medium">{d.role}</p>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>
                    {new Date(lead.updatedAt).toLocaleDateString()}
                  </span>
                  {d.matchScore !== undefined && (
                    <span
                      className={`font-semibold ${
                        d.matchScore >= 80
                          ? "text-green-600"
                          : d.matchScore >= 60
                            ? "text-amber-600"
                            : "text-red-500"
                      }`}
                    >
                      {d.matchScore}/100
                    </span>
                  )}
                  {d.workMode && (
                    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                      {d.workMode}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    STATUS_COLORS[lead.status] ?? ""
                  }`}
                >
                  {lead.status}
                </span>
                {d.url && (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-zinc-600"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
