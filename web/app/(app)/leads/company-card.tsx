"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Building2,
  Users,
  MapPin,
} from "lucide-react";
import { useChildItems } from "@/hooks/use-agent-items";
import type { CompanyGroup, ContactItem } from "./types";
import { WORK_MODE_LABELS } from "./types";
import { scoreColor, getBorderColor } from "./utils";
import { RoleCard } from "./role-card";
import { DMCard } from "./dm-card";

interface CompanyCardProps {
  group: CompanyGroup;
  index: number;
}

export function CompanyCard({ group, index }: CompanyCardProps) {
  const [expanded, setExpanded] = useState(false);

  const borderColor = getBorderColor(index);

  return (
    <div
      className={`rounded-xl border border-zinc-200 border-l-4 ${borderColor} bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950`}
    >
      {/* Company header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 p-5 text-left"
      >
        <span className="mt-0.5 text-zinc-400">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-zinc-400" />
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {group.name}
                </h3>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {group.leads.length}{" "}
                  {group.leads.length === 1 ? "role" : "roles"}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {group.fundingStage && (
                  <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
                    {group.fundingStage}
                  </span>
                )}
                {group.location && (
                  <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-600 dark:bg-orange-900/30 dark:text-orange-300">
                    <MapPin className="h-3 w-3" />
                    {group.location}
                  </span>
                )}
                {group.workModes.map((wm) => {
                  const label = WORK_MODE_LABELS[wm];
                  return label ? (
                    <span key={wm} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${label.color}`}>
                      {label.label}
                    </span>
                  ) : null;
                })}
                {group.archetype && (
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                    {group.archetype.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Best Score
              </p>
              <p
                className={`text-2xl font-bold ${scoreColor(group.bestScore)}`}
              >
                {group.bestScore}
              </p>
            </div>
          </div>

          {/* Company description */}
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
            {group.description}
          </p>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-zinc-100 px-5 pb-5 pt-4 dark:border-zinc-800/50">
          {/* Roles section */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Roles
            </h4>
            <div className="space-y-2">
              {group.leads.map((lead) => (
                <RoleCard key={lead._id} lead={lead} />
              ))}
            </div>
          </div>

          {/* Decision Makers section */}
          <CompanyContacts group={group} />
        </div>
      )}
    </div>
  );
}

function CompanyContacts({ group }: { group: CompanyGroup }) {
  // Collect contacts from all leads in this company group
  return (
    <div className="mt-6">
      <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        <Users className="h-3.5 w-3.5" />
        Decision Makers
      </h4>
      <div className="space-y-2">
        {group.leads.map((lead) => (
          <LeadContactsList
            key={lead._id}
            parentId={lead._id}
            company={group.name}
          />
        ))}
      </div>
      <NoContactsFallback leads={group.leads} />
    </div>
  );
}

function LeadContactsList({
  parentId,
  company,
}: {
  parentId: string;
  company: string;
}) {
  const children = useChildItems(parentId);

  if (!children || children.length === 0) return null;

  const contacts = children.filter(
    (c: any) => c.type === "contact"
  ) as ContactItem[];

  if (contacts.length === 0) return null;

  return (
    <>
      {contacts.map((contact) => (
        <DMCard
          key={contact._id}
          contact={contact}
          company={company}
        />
      ))}
    </>
  );
}

function NoContactsFallback({ leads }: { leads: CompanyGroup["leads"] }) {
  // We show a fallback if none of the leads have contacts
  // Since useChildItems is async, we render this as a placeholder
  // that will be replaced once contacts load
  return (
    <p className="text-xs text-zinc-400 mt-2">
      Contacts will appear here once discovered.
    </p>
  );
}
