"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";
import { X } from "lucide-react";
import type { QuickAddModalProps } from "./types";

const CONTACT_TYPES = [
  { value: "recruiter", label: "Recruiter" },
  { value: "hiring_manager", label: "Hiring Manager" },
  { value: "peer", label: "Peer" },
  { value: "founder", label: "Founder" },
  { value: "executive", label: "Executive" },
  { value: "other", label: "Other" },
] as const;

export function QuickAddModal({ companyId, onClose }: QuickAddModalProps) {
  const { activeAgent } = useAgent();
  const createConnection = useMutation(api.connectionRequests.create);
  const findOrCreatePerson = useMutation(api.people.findOrCreate);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [contactType, setContactType] = useState<string>("recruiter");
  const [noteSent, setNoteSent] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAgent || !name.trim()) return;

    setSaving(true);

    try {
      const personId = await findOrCreatePerson({ name: name.trim() });

      await createConnection({
        agentId: activeAgent._id,
        personId,
        companyId,
        contactRole: role.trim() || "Unknown",
        contactType: contactType as any,
        sentDate: Date.now(),
        status: "pending",
        noteWithRequest: noteSent,
        messageSent: false,
      });

      onClose();
    } catch (err) {
      console.error("Failed to add connection:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Connection</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Role / Title
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Senior Recruiter"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Type
            </label>
            <select
              value={contactType}
              onChange={(e) => setContactType(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {CONTACT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="noteSent"
              checked={noteSent}
              onChange={(e) => setNoteSent(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <label htmlFor="noteSent" className="text-sm text-zinc-700 dark:text-zinc-300">
              Sent a note with the request
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
