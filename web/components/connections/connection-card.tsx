"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { MessageSquare, AlertTriangle, Check, Clock, UserPlus } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  recruiter: "Recruiter",
  hiring_manager: "Hiring Mgr",
  peer: "Peer",
  founder: "Founder",
  executive: "Executive",
  other: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  suggested: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  ignored: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};

interface ConnectionCardProps {
  connection: any;
  personName?: string;
}

export function ConnectionCard({ connection, personName }: ConnectionCardProps) {
  const updateStatus = useMutation(api.connectionRequests.updateStatus);
  const markSent = useMutation(api.connectionRequests.markMessageSent);

  const daysPending =
    connection.status === "pending"
      ? Math.floor((Date.now() - connection.sentDate) / 86400000)
      : 0;

  const needsFollowUp =
    connection.status === "pending" &&
    !connection.noteWithRequest &&
    !connection.messageSent &&
    daysPending >= 3;

  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <UserPlus className="h-4 w-4 text-zinc-500" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {personName ?? "Unknown"}
            </span>
            <span className="text-xs text-zinc-500">
              {connection.contactRole}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                TYPE_LABELS[connection.contactType]
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : ""
              }`}
            >
              {TYPE_LABELS[connection.contactType] ?? connection.contactType}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Sent {new Date(connection.sentDate).toLocaleDateString()}</span>
            {connection.noteWithRequest && (
              <span className="flex items-center gap-0.5">
                <MessageSquare className="h-3 w-3" /> Note sent
              </span>
            )}
            {connection.messageSent && (
              <span className="flex items-center gap-0.5">
                <Check className="h-3 w-3 text-green-500" /> Messaged
              </span>
            )}
            {needsFollowUp && (
              <span className="flex items-center gap-0.5 text-amber-600">
                <AlertTriangle className="h-3 w-3" /> No note — {daysPending}d pending
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            STATUS_STYLES[connection.status] ?? ""
          }`}
        >
          {connection.status}
        </span>

        {connection.status === "pending" && (
          <div className="flex gap-1">
            <button
              onClick={() =>
                updateStatus({
                  requestId: connection._id as Id<"connectionRequests">,
                  status: "accepted",
                })
              }
              className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
            >
              Accepted
            </button>
            {!connection.messageSent && (
              <button
                onClick={() =>
                  markSent({
                    requestId: connection._id as Id<"connectionRequests">,
                  })
                }
                className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                Msg Sent
              </button>
            )}
          </div>
        )}

        {connection.status === "suggested" && (
          <button
            onClick={() =>
              updateStatus({
                requestId: connection._id as Id<"connectionRequests">,
                status: "pending",
              })
            }
            className="rounded bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
          >
            Reached Out
          </button>
        )}
      </div>
    </div>
  );
}
