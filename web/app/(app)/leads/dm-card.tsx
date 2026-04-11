"use client";

import { useState, useRef, useEffect } from "react";
import { Link2, Mail, Phone, MessageSquare, ChevronDown } from "lucide-react";
import type { ContactData } from "@/lib/types";
import type { OutreachChannel } from "./types";
import { CHANNEL_OPTIONS } from "./types";
import { OutreachDialog } from "./outreach-dialog";

interface DMCardProps {
  contact: {
    _id: string;
    parentId?: string;
    data: ContactData;
    [key: string]: unknown;
  };
  company: string;
}

export function DMCard({ contact, company }: DMCardProps) {
  const cd = contact.data;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dialogChannel, setDialogChannel] = useState<OutreachChannel | null>(
    null
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChannelSelect = (channel: OutreachChannel) => {
    setDropdownOpen(false);
    setDialogChannel(channel);
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-white p-3 dark:border-blue-900/30 dark:bg-zinc-900/50">
        {/* Avatar */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
          {cd.name?.charAt(0) ?? "?"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {cd.name}
            </span>
            <span className="text-xs text-zinc-400">-</span>
            <span className="text-xs text-zinc-500 truncate">{cd.title}</span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            {cd.linkedinUrl && (
              <a
                href={cd.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline dark:text-blue-400"
              >
                <Link2 className="h-3 w-3" />
                LinkedIn
              </a>
            )}
            {cd.email && (
              <a
                href={`mailto:${cd.email}`}
                className="flex items-center gap-1 text-[11px] text-amber-600 hover:underline dark:text-amber-400"
              >
                <Mail className="h-3 w-3" />
                {cd.email}
              </a>
            )}
            {cd.phone && (
              <a
                href={`tel:${cd.phone}`}
                className="flex items-center gap-1 text-[11px] text-emerald-600 hover:underline dark:text-emerald-400"
              >
                <Phone className="h-3 w-3" />
                {cd.phone}
              </a>
            )}
          </div>
        </div>

        {/* Generate Outreach dropdown */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Generate Outreach
            <ChevronDown className="h-3 w-3" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
              {CHANNEL_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleChannelSelect(opt.key)}
                  className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {opt.label}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {opt.description}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Outreach dialog */}
      {dialogChannel && contact.parentId && (
        <OutreachDialog
          open={true}
          onClose={() => setDialogChannel(null)}
          contactId={contact._id}
          leadId={contact.parentId}
          contactName={cd.name}
          contactTitle={cd.title}
          company={company}
          channel={dialogChannel}
        />
      )}
    </>
  );
}
