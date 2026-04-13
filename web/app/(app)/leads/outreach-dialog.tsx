"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X, Loader2, Copy, Check } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type { OutreachChannel } from "./types";

interface OutreachDialogProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
  leadId: string;
  contactName: string;
  contactTitle: string;
  company: string;
  channel: OutreachChannel;
}

const CHANNEL_LABELS: Record<OutreachChannel, string> = {
  connection_request: "Connection Request",
  first_message: "First Message",
  email: "Email",
  whatsapp: "WhatsApp",
};

export function OutreachDialog({
  open,
  onClose,
  contactId,
  leadId,
  contactName,
  company,
  channel,
}: OutreachDialogProps) {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const generateOutreach = useAction(api.outreach.generate);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setContent("");
    setError(null);

    generateOutreach({
      contactId: contactId as Id<"agentItems">,
      leadId: leadId as Id<"agentItems">,
      channel,
    })
      .then((result) => {
        setContent(result.body);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message ?? "Failed to generate outreach");
        setLoading(false);
      });
  }, [open, contactId, leadId, channel, generateOutreach]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {CHANNEL_LABELS[channel]}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              To {contactName} at {company}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <p className="mt-3 text-sm text-zinc-500">
                Generating outreach draft...
              </p>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          ) : (
            <div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:focus:ring-blue-900"
              />
              {(channel === "connection_request" || channel === "whatsapp") && (
                <p
                  className={`mt-1 text-right text-[11px] ${
                    content.length > 300
                      ? "text-red-500"
                      : "text-zinc-400"
                  }`}
                >
                  {content.length}/300 characters
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && (
          <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-700">
            <button
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
