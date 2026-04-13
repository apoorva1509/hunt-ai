"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type { MessageChannel } from "./types";
import { CHANNEL_LABELS } from "./types";

interface LogMessageDialogProps {
  open: boolean;
  onClose: () => void;
  contactId: Id<"outreachContacts">;
  companyId: Id<"outreachCompanies">;
  prefillBody?: string;
  prefillChannel?: MessageChannel;
}

export function LogMessageDialog({
  open,
  onClose,
  contactId,
  companyId,
  prefillBody,
  prefillChannel,
}: LogMessageDialogProps) {
  const [channel, setChannel] = useState<MessageChannel>(
    prefillChannel ?? "linkedin_dm"
  );
  const [body, setBody] = useState(prefillBody ?? "");
  const [sentAt, setSentAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [direction, setDirection] = useState<"outbound" | "inbound">(
    "outbound"
  );
  const [loading, setLoading] = useState(false);
  const createMessage = useMutation(api.outreachMessages.create);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    try {
      await createMessage({
        contactId,
        companyId,
        channel,
        body: body.trim(),
        sentAt: new Date(sentAt).getTime(),
        direction,
      });
      setBody("");
      setSentAt(new Date().toISOString().split("T")[0]);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Log Message</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as MessageChannel)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {Object.entries(CHANNEL_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Date Sent
              </label>
              <input
                type="date"
                value={sentAt}
                onChange={(e) => setSentAt(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Direction
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  checked={direction === "outbound"}
                  onChange={() => setDirection("outbound")}
                />
                Sent
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  checked={direction === "inbound"}
                  onChange={() => setDirection("inbound")}
                />
                Received
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Paste the message you sent or received..."
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              autoFocus
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading || !body.trim()}
              className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {loading ? "Saving..." : "Log Message"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
