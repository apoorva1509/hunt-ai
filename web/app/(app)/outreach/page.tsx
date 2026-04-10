"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";
import { useOutreachDrafts } from "@/hooks/use-agent-items";
import type { Id } from "@/convex/_generated/dataModel";

const STATUS_TABS = ["all", "new", "approved", "actioned", "skipped"] as const;
const CHANNEL_COLORS: Record<string, string> = {
  linkedin: "bg-blue-100 text-blue-800",
  email: "bg-amber-100 text-amber-800",
  whatsapp: "bg-green-100 text-green-800",
};

export default function OutreachPage() {
  const { activeAgent } = useAgent();
  const drafts = useOutreachDrafts();
  const updateStatus = useMutation(api.agentItems.updateItemStatus);
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!activeAgent) {
    return <p className="text-zinc-500">Select an agent first.</p>;
  }

  if (drafts === undefined) {
    return <p className="text-zinc-500">Loading drafts...</p>;
  }

  const filtered =
    tab === "all" ? drafts : drafts.filter((d: any) => d.status === tab);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        Outreach Drafts ({drafts.length})
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t} (
            {t === "all"
              ? drafts.length
              : drafts.filter((d: any) => d.status === t).length}
            )
          </button>
        ))}
      </div>

      {/* Draft cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-zinc-500">No drafts in this category.</p>
        ) : (
          filtered.map((draft: any) => (
            <div
              key={draft._id}
              className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div
                className="flex cursor-pointer items-center justify-between px-5 py-3"
                onClick={() =>
                  setExpandedId(expandedId === draft._id ? null : draft._id)
                }
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      CHANNEL_COLORS[draft.data.channel] ?? "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {draft.data.channel}
                  </span>
                  <span className="font-medium">{draft.title}</span>
                  {draft.subtitle && (
                    <span className="text-sm text-zinc-500">
                      {draft.subtitle}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {draft.data.messageScore && (
                    <span
                      className={`text-sm font-semibold ${
                        draft.data.messageScore.total >= 80
                          ? "text-green-600"
                          : draft.data.messageScore.total >= 60
                            ? "text-amber-600"
                            : "text-red-500"
                      }`}
                    >
                      {draft.data.messageScore.total}/100
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      draft.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : draft.status === "actioned"
                          ? "bg-blue-100 text-blue-800"
                          : draft.status === "skipped"
                            ? "bg-zinc-100 text-zinc-500"
                            : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {draft.status}
                  </span>
                </div>
              </div>

              {expandedId === draft._id && (
                <div className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
                  {draft.data.subject && (
                    <p className="mb-2 text-sm">
                      <span className="font-medium">Subject:</span>{" "}
                      {draft.data.subject}
                    </p>
                  )}
                  <div className="whitespace-pre-wrap rounded bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
                    {draft.data.body}
                  </div>
                  {draft.data.ps && (
                    <p className="mt-2 text-sm italic text-zinc-500">
                      PS: {draft.data.ps}
                    </p>
                  )}

                  {draft.data.charCount && (
                    <p className="mt-2 text-xs text-zinc-400">
                      {draft.data.charCount} chars
                      {draft.data.sendAfter && ` | Send after: ${draft.data.sendAfter}`}
                      {draft.data.sequenceStep && ` | Step ${draft.data.sequenceStep}`}
                    </p>
                  )}

                  {/* Action buttons */}
                  {draft.status === "new" && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() =>
                          updateStatus({
                            itemId: draft._id as Id<"agentItems">,
                            status: "approved",
                          })
                        }
                        className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          updateStatus({
                            itemId: draft._id as Id<"agentItems">,
                            status: "skipped",
                          })
                        }
                        className="rounded bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-300"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                  {draft.status === "approved" && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() =>
                          updateStatus({
                            itemId: draft._id as Id<"agentItems">,
                            status: "actioned",
                          })
                        }
                        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Mark Sent
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
