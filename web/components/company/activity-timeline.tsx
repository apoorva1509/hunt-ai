"use client";

import { Clock, UserPlus, Send, Briefcase, MessageSquare } from "lucide-react";

interface TimelineEvent {
  date: number;
  icon: "connection" | "message" | "application" | "outreach";
  description: string;
}

interface ActivityTimelineProps {
  connections: any[];
  leads: any[];
  drafts: any[];
  people: Map<string, string>;
}

const ICONS = {
  connection: UserPlus,
  message: MessageSquare,
  application: Briefcase,
  outreach: Send,
};

export function ActivityTimeline({
  connections,
  leads,
  drafts,
  people,
}: ActivityTimelineProps) {
  const events: TimelineEvent[] = [];

  for (const conn of connections) {
    const name = people.get(conn.personId) ?? "Unknown";
    events.push({
      date: conn.sentDate,
      icon: "connection",
      description: `Connection request sent to ${name} (${conn.contactRole})${
        conn.noteWithRequest ? " with note" : ""
      }`,
    });
    if (conn.messageSent && conn.messageDate) {
      events.push({
        date: conn.messageDate,
        icon: "message",
        description: `Follow-up message sent to ${name}`,
      });
    }
  }

  for (const lead of leads) {
    events.push({
      date: lead.updatedAt,
      icon: "application",
      description: `${lead.data?.role ?? "Role"} — ${lead.status}`,
    });
  }

  for (const draft of drafts) {
    events.push({
      date: draft.updatedAt,
      icon: "outreach",
      description: `Outreach draft: ${draft.title} (${draft.status})`,
    });
  }

  events.sort((a, b) => b.date - a.date);

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Clock className="h-4 w-4" />
        Activity Timeline
      </h3>
      <div className="space-y-2">
        {events.slice(0, 20).map((event, i) => {
          const Icon = ICONS[event.icon];
          return (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <Icon className="h-3 w-3 text-zinc-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {event.description}
                </p>
                <p className="text-xs text-zinc-400">
                  {new Date(event.date).toLocaleDateString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
