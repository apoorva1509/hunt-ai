"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X, Check } from "lucide-react";
import { APPLIED_VIA_OPTIONS } from "./types";
import type { Id } from "@/convex/_generated/dataModel";

interface MarkAppliedDialogProps {
  open: boolean;
  onClose: () => void;
  jobId: Id<"outreachJobs"> | null;
  jobTitle: string;
  companyName: string;
}

export function MarkAppliedDialog({ open, onClose, jobId, jobTitle, companyName }: MarkAppliedDialogProps) {
  const [selectedVia, setSelectedVia] = useState("");
  const [notes, setNotes] = useState("");
  const markApplied = useMutation(api.outreachJobs.markApplied);

  if (!open || !jobId) return null;

  const handleSubmit = async () => {
    if (!selectedVia) return;
    await markApplied({
      id: jobId,
      appliedVia: selectedVia,
      appliedNotes: notes || undefined,
    });
    setSelectedVia("");
    setNotes("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-900">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Mark as Applied</h3>
            <p className="text-sm text-zinc-500">{jobTitle} at {companyName}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Applied via</label>
            <div className="flex flex-wrap gap-2">
              {APPLIED_VIA_OPTIONS.map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setSelectedVia(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                    selectedVia === key
                      ? `${color} text-white ring-2 ring-offset-2 ring-zinc-400`
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Applied with ML-focused resume"
              rows={2}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedVia}
              className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
