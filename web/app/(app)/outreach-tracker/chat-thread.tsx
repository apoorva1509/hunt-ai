"use client";

import { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Trash2 } from "lucide-react";
import type { OutreachMessage, MessageChannel } from "./types";
import { CHANNEL_LABELS } from "./types";
import { formatDate } from "./utils";

const CHANNEL_TABS: { key: MessageChannel | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "linkedin_dm", label: "LinkedIn" },
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp" },
];

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function ChatBubble({
  msg,
  onDelete,
}: {
  msg: OutreachMessage;
  onDelete: () => void;
}) {
  const isOutbound = msg.direction === "outbound";

  return (
    <div
      className={`group flex items-start gap-1 ${isOutbound ? "justify-end" : "justify-start"}`}
    >
      {isOutbound && (
        <button
          onClick={onDelete}
          className="mt-2 opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition-all shrink-0"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 ${
          isOutbound
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100 rounded-bl-sm"
        }`}
      >
        <p className="text-[13px] whitespace-pre-wrap break-words leading-relaxed">
          {msg.body}
        </p>
        <div
          className={`flex items-center gap-1.5 mt-1 ${
            isOutbound ? "justify-end" : "justify-start"
          }`}
        >
          <span
            className={`text-[10px] ${
              isOutbound ? "text-blue-200" : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            {formatTime(msg.sentAt)}
          </span>
          {msg.channel !== "linkedin_dm" && (
            <span
              className={`text-[9px] px-1 py-0.5 rounded ${
                isOutbound
                  ? "bg-blue-500/40 text-blue-100"
                  : "bg-zinc-300 text-zinc-600 dark:bg-zinc-600 dark:text-zinc-300"
              }`}
            >
              {CHANNEL_LABELS[msg.channel]}
            </span>
          )}
        </div>
      </div>
      {!isOutbound && (
        <button
          onClick={onDelete}
          className="mt-2 opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition-all shrink-0"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function DateDivider({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
      <span className="text-[10px] font-medium text-zinc-400 shrink-0">
        {date}
      </span>
      <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
    </div>
  );
}

interface ChatThreadProps {
  messages: OutreachMessage[];
}

export function ChatThread({ messages }: ChatThreadProps) {
  const [activeChannel, setActiveChannel] = useState<MessageChannel | "all">(
    "all"
  );
  const removeMessage = useMutation(api.outreachMessages.remove);

  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = { all: messages.length };
    for (const msg of messages) {
      counts[msg.channel] = (counts[msg.channel] ?? 0) + 1;
    }
    return counts;
  }, [messages]);

  const filtered = useMemo(() => {
    const msgs =
      activeChannel === "all"
        ? [...messages]
        : messages.filter((m) => m.channel === activeChannel);
    return msgs.sort((a, b) => a.sentAt - b.sentAt);
  }, [messages, activeChannel]);

  const grouped = useMemo(() => {
    const groups: { date: string; msgs: OutreachMessage[] }[] = [];
    let currentDate = "";
    for (const msg of filtered) {
      const date = formatDate(msg.sentAt);
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ date, msgs: [] });
      }
      groups[groups.length - 1].msgs.push(msg);
    }
    return groups;
  }, [filtered]);

  const visibleTabs = CHANNEL_TABS.filter(
    (tab) => tab.key === "all" || (channelCounts[tab.key] ?? 0) > 0
  );

  return (
    <div>
      {visibleTabs.length > 2 && (
        <div className="flex gap-1 mb-3">
          {visibleTabs.map((tab) => {
            const count = channelCounts[tab.key] ?? 0;
            const isActive = activeChannel === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveChannel(tab.key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`ml-1 ${
                      isActive
                        ? "text-zinc-400 dark:text-zinc-500"
                        : "text-zinc-400"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto rounded-lg bg-white border border-zinc-200 p-3 dark:bg-zinc-900 dark:border-zinc-700">
          {grouped.map((group) => (
            <div key={group.date} className="space-y-1.5">
              <DateDivider date={group.date} />
              {group.msgs.map((msg) => (
                <ChatBubble
                  key={msg._id}
                  msg={msg}
                  onDelete={() => removeMessage({ id: msg._id })}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-400">
          No{" "}
          {activeChannel === "all"
            ? ""
            : CHANNEL_LABELS[activeChannel] + " "}
          messages yet.
        </p>
      )}
    </div>
  );
}
