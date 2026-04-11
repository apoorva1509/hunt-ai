"use client";

import { useState } from "react";
import { X, Upload } from "lucide-react";

interface ImportLinkedinDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: {
    contactLinkedinUrl: string;
    messages: Array<{
      body: string;
      direction: "outbound" | "inbound";
      sentAt: string;
    }>;
  }) => void;
}

export function ImportLinkedinDialog({
  open,
  onClose,
  onImport,
}: ImportLinkedinDialogProps) {
  const [pasteValue, setPasteValue] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const handleImport = () => {
    setError("");
    try {
      const data = JSON.parse(pasteValue);
      if (!data.contactLinkedinUrl || !data.messages?.length) {
        setError(
          "Invalid format. Make sure you copied from the LinkedIn bookmarklet."
        );
        return;
      }
      onImport(data);
      setPasteValue("");
      onClose();
    } catch {
      setError("Invalid JSON. Paste the exact text copied by the bookmarklet.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-900">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Import LinkedIn Messages</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-zinc-500">
            1. Open a LinkedIn conversation in your browser
            <br />
            2. Click the &quot;Sync LinkedIn&quot; bookmarklet
            <br />
            3. Paste the copied data below
          </p>

          <textarea
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            placeholder='Paste copied LinkedIn messages here (JSON)...'
            rows={6}
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-800"
          />

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!pasteValue.trim()}
              className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              Import Messages
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
