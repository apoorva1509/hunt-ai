"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X, Search, Loader2 } from "lucide-react";

interface AddCompanyDialogProps {
  open: boolean;
  onClose: () => void;
}

function detectInputType(input: string): {
  name: string;
  websiteUrl?: string;
  linkedinUrl?: string;
} {
  const trimmed = input.trim();

  // LinkedIn company URL
  if (trimmed.includes("linkedin.com/company/")) {
    const slug = trimmed.match(/company\/([^/?]+)/)?.[1] ?? "";
    const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return { name, linkedinUrl: trimmed };
  }

  // Website URL (contains dots, no spaces)
  if (trimmed.includes(".") && !trimmed.includes(" ")) {
    const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    let domain: string;
    try {
      domain = new URL(url).hostname.replace("www.", "");
    } catch {
      domain = trimmed;
    }
    const name = domain.split(".")[0].replace(/\b\w/g, (c) => c.toUpperCase());
    return { name, websiteUrl: url };
  }

  // Plain company name
  return { name: trimmed };
}

export function AddCompanyDialog({ open, onClose }: AddCompanyDialogProps) {
  const [input, setInput] = useState("");
  const [roleAppliedFor, setRoleAppliedFor] = useState("");
  const [loading, setLoading] = useState(false);
  const addCompany = useAction(api.outreachCompanies.addCompanyWithEnrichment);
  const researchCompany = useAction(api.companyResearch.researchCompany);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    try {
      const detected = detectInputType(input);
      const { companyId } = await addCompany({
        name: detected.name,
        websiteUrl: detected.websiteUrl,
        roleAppliedFor: roleAppliedFor.trim() || undefined,
      });

      // Trigger research in background
      researchCompany({
        companyId: companyId as any,
        input: input.trim(),
      }).catch(console.error);

      setInput("");
      setRoleAppliedFor("");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const detected = input.trim() ? detectInputType(input) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Research Company</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Company name or URL *
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., Stripe, stripe.com, or linkedin.com/company/stripe"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              autoFocus
            />
            {detected && input.trim() && (
              <p className="mt-1 text-[11px] text-zinc-400">
                {detected.linkedinUrl
                  ? `LinkedIn company: ${detected.name}`
                  : detected.websiteUrl
                    ? `Website: ${detected.websiteUrl}`
                    : `Company name: ${detected.name}`}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Target role (optional)
            </label>
            <input
              type="text"
              value={roleAppliedFor}
              onChange={(e) => setRoleAppliedFor(e.target.value)}
              placeholder="e.g., Senior Backend Engineer"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <p className="text-xs text-zinc-500">
            Jobs, contacts, and pipeline steps will be auto-discovered.
          </p>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Research
                </>
              )}
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
