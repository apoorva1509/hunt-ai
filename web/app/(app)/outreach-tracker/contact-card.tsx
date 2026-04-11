"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";
import {
  useOutreachMessages,
  useOutreachGuidance,
  useFollowUpRemindersByContact,
} from "@/hooks/use-outreach-tracker";
import {
  BellOff,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Link2,
  Mail,
  Phone,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { OutreachContact } from "./types";
import {
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  GUIDANCE_CHANNELS,
} from "./types";
import { formatDate, isOverdue } from "./utils";
import { FollowUpBadge } from "./follow-up-badge";
import { LogMessageDialog } from "./log-message-dialog";
import type { Id } from "@/convex/_generated/dataModel";

interface ContactCardProps {
  contact: OutreachContact;
  companyId: Id<"outreachCompanies">;
}

export function ContactCard({ contact, companyId }: ContactCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showLogMessage, setShowLogMessage] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    channel: string;
    message: string;
    reasoning: string;
  } | null>(null);

  const messages = useOutreachMessages(expanded ? contact._id : null);
  const guidance = useOutreachGuidance(expanded ? contact._id : null);
  const reminders = useFollowUpRemindersByContact(contact._id);
  const activeReminder = reminders?.find((r: any) => isOverdue(r));
  const upsertGuidance = useMutation(api.outreachGuidance.upsert);
  const removeContact = useMutation(api.outreachContacts.remove);
  const dismissReminder = useMutation(api.followUpReminders.dismiss);
  const stopFollowUp = useMutation(api.outreachContacts.stopFollowUp);
  const suggestFollowUp = useAction(api.outreachSuggest.suggestFollowUp);
  const { activeAgent } = useAgent();

  const handleSuggest = async () => {
    if (!activeAgent) return;
    setSuggesting(true);
    try {
      const result = await suggestFollowUp({
        contactId: contact._id,
        companyId,
        agentId: activeAgent._id,
      });
      setSuggestion(result);
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-3 p-3 text-left"
        >
          <span className="text-zinc-400">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
          {contact.profilePictureUrl ? (
            <img
              src={contact.profilePictureUrl}
              alt={contact.name}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
              {contact.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{contact.name}</p>
              {activeReminder && <FollowUpBadge reminder={activeReminder} />}
            </div>
            {contact.title && (
              <p className="text-xs text-zinc-500">{contact.title}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {contact.linkedinUrl && (
              <a
                href={contact.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-blue-500 hover:text-blue-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                onClick={(e) => e.stopPropagation()}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <Mail className="h-3.5 w-3.5" />
              </a>
            )}
            {contact.phone && (
              <Phone className="h-3.5 w-3.5 text-zinc-400" />
            )}
            <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
              {contact.source}
            </span>
          </div>
        </button>

        {expanded && (
          <div className="border-t border-zinc-200 px-3 pb-3 pt-3 dark:border-zinc-700 space-y-4">
            {/* Messages */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Messages
                </h5>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleSuggest}
                    disabled={suggesting}
                    className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-200 disabled:opacity-50 dark:bg-purple-900/40 dark:text-purple-300"
                  >
                    <Sparkles className="h-3 w-3" />
                    {suggesting ? "Thinking..." : "Suggest Follow-up"}
                  </button>
                  <button
                    onClick={() => setShowLogMessage(true)}
                    className="flex items-center gap-1 rounded-md bg-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
                  >
                    <Plus className="h-3 w-3" />
                    Log Message
                  </button>
                </div>
              </div>

              {/* AI Suggestion */}
              {suggestion && (
                <div className="mb-3 rounded-md border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-950">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                    <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                      Suggested via {suggestion.channel}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                    {suggestion.message}
                  </p>
                  <p className="mt-2 text-xs text-purple-600 dark:text-purple-400 italic">
                    {suggestion.reasoning}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(suggestion.message);
                      }}
                      className="rounded bg-purple-200 px-2 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-300 dark:bg-purple-800 dark:text-purple-200"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => {
                        setShowLogMessage(true);
                        setSuggestion(null);
                      }}
                      className="rounded bg-purple-200 px-2 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-300 dark:bg-purple-800 dark:text-purple-200"
                    >
                      Log as Sent
                    </button>
                    <button
                      onClick={() => setSuggestion(null)}
                      className="rounded bg-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-400"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Follow-up Actions */}
              {activeReminder && !suggestion && (
                <div className="mb-3 rounded-md border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-900/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                      Follow-up due &mdash;{" "}
                      {activeReminder.channel === "email"
                        ? "Email"
                        : "LinkedIn"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleSuggest}
                      disabled={suggesting}
                      className="flex items-center gap-1 rounded-md bg-purple-100 px-2 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300"
                    >
                      <Sparkles className="h-3 w-3" />
                      Generate Follow-up
                    </button>
                    {contact.linkedinUrl &&
                      activeReminder.channel !== "email" && (
                        <button
                          onClick={async () => {
                            const linkedinUrl = contact.linkedinUrl!;
                            const messagingUrl = linkedinUrl.includes(
                              "/messaging/"
                            )
                              ? linkedinUrl
                              : linkedinUrl.replace(/\/?$/, "") +
                                "/overlay/messaging/";
                            window.open(messagingUrl, "_blank");
                          }}
                          className="flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300"
                        >
                          <Link2 className="h-3 w-3" />
                          Open LinkedIn
                        </button>
                      )}
                    <button
                      onClick={() =>
                        dismissReminder({ id: activeReminder._id })
                      }
                      className="flex items-center gap-1 rounded-md bg-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-400"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() =>
                        stopFollowUp({ id: contact._id, reason: "manual" })
                      }
                      className="flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
                    >
                      <BellOff className="h-3 w-3" />
                      Stop Follow-ups
                    </button>
                  </div>
                </div>
              )}

              {/* Follow-up stopped indicator */}
              {contact.followUpEnabled === false &&
                contact.followUpStoppedReason && (
                  <div className="mb-3 flex items-center gap-1.5 text-xs text-zinc-400">
                    <BellOff className="h-3 w-3" />
                    Follow-ups stopped:{" "}
                    {contact.followUpStoppedReason === "replied"
                      ? "Contact replied"
                      : contact.followUpStoppedReason === "closed"
                        ? "Company closed"
                        : "Stopped manually"}
                  </div>
                )}

              {/* Message list */}
              {messages && messages.length > 0 ? (
                <div className="space-y-2">
                  {messages.map((msg: any) => (
                    <div
                      key={msg._id}
                      className="rounded-md border border-zinc-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${CHANNEL_COLORS[msg.channel as keyof typeof CHANNEL_COLORS] ?? "bg-zinc-100 text-zinc-500"}`}
                        >
                          {CHANNEL_LABELS[msg.channel as keyof typeof CHANNEL_LABELS] ?? msg.channel}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {msg.direction === "inbound" ? "Received" : "Sent"}{" "}
                          {formatDate(msg.sentAt)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap line-clamp-3">
                        {msg.body}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400">
                  No messages logged yet.
                </p>
              )}
            </div>

            {/* Guidance */}
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Guidance per Channel
              </h5>
              <div className="space-y-2">
                {GUIDANCE_CHANNELS.map(({ key, label }) => {
                  const existing = guidance?.find(
                    (g: any) => g.channel === key
                  );
                  return (
                    <div key={key}>
                      <label className="block text-[11px] font-medium text-zinc-500 mb-0.5">
                        {label}
                      </label>
                      <textarea
                        defaultValue={existing?.guidance ?? ""}
                        placeholder={`Set tone/angle for ${label} messages...`}
                        rows={2}
                        className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val !== (existing?.guidance ?? "")) {
                            upsertGuidance({
                              contactId: contact._id,
                              channel: key,
                              guidance: val,
                            });
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delete contact */}
            <div className="border-t border-zinc-200 pt-2 dark:border-zinc-700">
              <button
                onClick={() => removeContact({ id: contact._id })}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" />
                Remove contact
              </button>
            </div>
          </div>
        )}
      </div>

      <LogMessageDialog
        open={showLogMessage}
        onClose={() => setShowLogMessage(false)}
        contactId={contact._id}
        companyId={companyId}
        prefillBody={suggestion?.message}
        prefillChannel={
          suggestion?.channel === "linkedin"
            ? "linkedin_dm"
            : suggestion?.channel === "email"
              ? "email"
              : suggestion?.channel === "whatsapp"
                ? "whatsapp"
                : undefined
        }
      />
    </>
  );
}
