"use client";

import { AlertTriangle, MessageSquare, Send } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { NextStep, NextStepsPanelProps } from "./types";

export function NextStepsPanel({ connections, people }: NextStepsPanelProps) {
  const updateStatus = useMutation(api.connectionRequests.updateStatus);
  const markSent = useMutation(api.connectionRequests.markMessageSent);

  const steps: NextStep[] = [];

  for (const conn of connections) {
    const personName = people.get(conn.personId) ?? "Unknown";
    const daysPending = Math.floor((Date.now() - conn.sentDate) / 86400000);

    if (
      conn.status === "pending" &&
      !conn.noteWithRequest &&
      !conn.messageSent &&
      daysPending >= 3
    ) {
      steps.push({
        id: `followup-${conn._id}`,
        type: "follow_up",
        connectionId: conn._id,
        personName,
        description: `Follow up with ${personName} — pending ${daysPending}d, no note sent`,
        urgency: daysPending,
      });
    }

    if (conn.status === "accepted" && !conn.messageSent) {
      steps.push({
        id: `thank-${conn._id}`,
        type: "thank_accepted",
        connectionId: conn._id,
        personName,
        description: `${personName} accepted — send a thank you / intro message`,
        urgency: 1,
      });
    }
  }

  steps.sort((a, b) => b.urgency - a.urgency);

  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4" />
        Next Steps ({steps.length})
      </h3>
      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex items-center justify-between rounded-md bg-white px-3 py-2 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2 text-sm">
              {step.type === "follow_up" ? (
                <Send className="h-4 w-4 text-amber-600" />
              ) : (
                <MessageSquare className="h-4 w-4 text-green-600" />
              )}
              <span>{step.description}</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() =>
                  markSent({ requestId: step.connectionId })
                }
                className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                Mark Done
              </button>
              <button
                onClick={() =>
                  updateStatus({
                    requestId: step.connectionId,
                    status: "ignored",
                  })
                }
                className="rounded bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
              >
                Skip
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
