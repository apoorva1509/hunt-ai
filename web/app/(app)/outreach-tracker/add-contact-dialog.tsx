"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

interface AddContactDialogProps {
  open: boolean;
  onClose: () => void;
  companyId: Id<"outreachCompanies">;
}

export function AddContactDialog({
  open,
  onClose,
  companyId,
}: AddContactDialogProps) {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const enrichContact = useAction(api.outreachContacts.enrichFromLinkedin);
  const createContact = useMutation(api.outreachContacts.create);

  if (!open) return null;

  const handleEnrich = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedinUrl.trim()) return;
    setLoading(true);
    try {
      const result = await enrichContact({
        companyId,
        linkedinUrl: linkedinUrl.trim(),
      });
      if (result.success) {
        setLinkedinUrl("");
        onClose();
      } else {
        setShowManual(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    setLoading(true);
    try {
      await createContact({
        companyId,
        name: manualName.trim(),
        title: manualTitle.trim() || undefined,
        linkedinUrl: linkedinUrl.trim() || undefined,
        email: manualEmail.trim() || undefined,
        source: "manual",
      });
      setLinkedinUrl("");
      setManualName("");
      setManualTitle("");
      setManualEmail("");
      setShowManual(false);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Add Contact</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!showManual ? (
          <form onSubmit={handleEnrich} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                LinkedIn Profile URL
              </label>
              <input
                type="text"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/username"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                autoFocus
              />
            </div>
            <p className="text-xs text-zinc-500">
              We'll auto-fetch name, title, email via Apollo + LinkedIn.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading || !linkedinUrl.trim()}
                className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {loading ? "Enriching..." : "Add & Enrich"}
              </button>
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Manual Entry
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Auto-enrichment didn't find results. Enter details manually.
            </p>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="e.g., CEO"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading || !manualName.trim()}
                className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {loading ? "Saving..." : "Save Contact"}
              </button>
              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
