"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useChildItems } from "@/hooks/use-agent-items";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MapPin,
  Globe,
  Building2,
  Briefcase,
  Copy,
  Check,
  FileText,
  DollarSign,
  Link2,
  Mail,
  Phone,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type { JobLeadData, ContactData, OutreachDraftData } from "@/lib/types";

const SOURCE_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  yc_wats: "YC WATS",
  wellfound: "Wellfound",
  naukri: "Naukri",
  instahyre: "Instahyre",
  cutshort: "Cutshort",
  hn_hiring: "HN Hiring",
  topstartups: "TopStartups",
  other: "Other",
};

const WORK_MODE_LABELS: Record<string, { label: string; color: string }> = {
  remote: { label: "Remote", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  hybrid: { label: "Hybrid", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  onsite: { label: "On-site", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  unknown: { label: "—", color: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
};

const SCORE_LABELS: Record<string, string> = {
  northStar: "North Star",
  cvMatch: "CV Match",
  seniority: "Seniority",
  compensation: "Comp",
  growth: "Growth",
  remoteQuality: "Remote",
  reputation: "Reputation",
  techStack: "Tech Stack",
  speedToOffer: "Speed",
  culturalSignals: "Culture",
};

export function LeadCard({ lead }: { lead: any }) {
  const [expanded, setExpanded] = useState(false);
  const [showJD, setShowJD] = useState(false);
  const [copied, setCopied] = useState(false);
  const updateStatus = useMutation(api.agentItems.updateItemStatus);
  const d = lead.data as JobLeadData;

  const wm = WORK_MODE_LABELS[d.workMode ?? "unknown"];
  const source = SOURCE_LABELS[d.jobBoard] ?? d.jobBoard;
  const hasSalary = d.salary || d.compensationRange;

  const formatSalary = () => {
    if (d.compensationRange?.min || d.compensationRange?.max) {
      const cur = d.compensationRange.currency ?? "$";
      const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;
      if (d.compensationRange.min && d.compensationRange.max) {
        return `${cur} ${fmt(d.compensationRange.min)}-${fmt(d.compensationRange.max)}`;
      }
      return `${cur} ${fmt(d.compensationRange.min ?? d.compensationRange.max!)}+`;
    }
    if (d.salary) return `$${Math.round(d.salary / 1000)}k`;
    return null;
  };

  const copyJD = async () => {
    const text = `${d.company} — ${d.role}\n${d.url}\n\n${d.fullDescription ?? "No JD available"}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span className="mt-1 text-zinc-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-medium">{d.company} — {d.role}</h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {/* Source badge */}
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {source}
                </span>
                {/* Work mode */}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${wm.color}`}>
                  {wm.label}
                </span>
                {/* Location */}
                {d.location && (
                  <span className="flex items-center gap-0.5 text-xs text-zinc-500">
                    <MapPin className="h-3 w-3" />
                    {d.location}
                  </span>
                )}
                {/* Salary */}
                {hasSalary && (
                  <span className="flex items-center gap-0.5 text-xs text-zinc-500">
                    <DollarSign className="h-3 w-3" />
                    {formatSalary()}
                  </span>
                )}
                {/* Funding */}
                {d.fundingStage && (
                  <span className="text-xs text-zinc-400">{d.fundingStage}</span>
                )}
                {/* Archetype */}
                <span className="text-xs text-zinc-400">{d.archetype.replace(/_/g, " ")}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-lg font-bold ${
                  d.matchScore >= 80 ? "text-green-600"
                    : d.matchScore >= 60 ? "text-amber-600"
                      : "text-red-500"
                }`}
              >
                {d.matchScore}
              </span>
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-3 dark:border-zinc-800/50">
          {/* Score dimensions */}
          <div className="grid grid-cols-5 gap-1.5">
            {Object.entries(d.scoreDimensions)
              .filter(([k]) => k !== "total")
              .map(([key, val]) => (
                <div key={key} className="rounded bg-zinc-50 px-2 py-1 text-center dark:bg-zinc-900">
                  <p className="text-[10px] text-zinc-500">{SCORE_LABELS[key] ?? key}</p>
                  <p className="text-sm font-medium">{val as number}</p>
                </div>
              ))}
          </div>

          {/* Job Description */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowJD(!showJD)}
                className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                <FileText className="h-4 w-4" />
                Job Description
                {showJD ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
              <button
                onClick={copyJD}
                className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy JD"}
              </button>
            </div>
            {showJD && d.fullDescription && (
              <pre className="mt-2 max-h-[300px] overflow-auto rounded-lg border border-zinc-100 bg-zinc-50 p-3 font-sans text-xs leading-relaxed text-zinc-600 whitespace-pre-wrap dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                {d.fullDescription}
              </pre>
            )}
            {showJD && !d.fullDescription && (
              <p className="mt-2 text-xs text-zinc-400">No job description scraped for this role.</p>
            )}
          </div>

          {/* Analysis grid */}
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <AnalysisCard title="Core Pain" text={d.corePain} />
            <AnalysisCard title="Match Reason" text={d.matchReason} />
            <AnalysisCard title="AI Gap" text={d.aiGap} />
            <AnalysisCard title="Urgency Signal" text={d.urgencySignal} />
          </div>

          {/* Tech stack */}
          {d.techStack?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {d.techStack.map((t: string) => (
                <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800/50">
            {lead.status === "new" && (
              <>
                <button
                  onClick={() => updateStatus({ itemId: lead._id as Id<"agentItems">, status: "approved" })}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                >
                  Approve Lead
                </button>
                <button
                  onClick={() => updateStatus({ itemId: lead._id as Id<"agentItems">, status: "skipped" })}
                  className="rounded-md bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  Skip
                </button>
              </>
            )}
            <button
              onClick={copyJD}
              className="ml-auto flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
              title="Copy JD to clipboard, then use /career-ops pdf to generate a tailored resume"
            >
              <Briefcase className="h-3.5 w-3.5" />
              Tailor Resume
            </button>
          </div>

          {/* Contacts & Outreach */}
          <LeadContacts parentId={lead._id} />
        </div>
      )}
    </div>
  );
}

function AnalysisCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-zinc-100 p-2.5 dark:border-zinc-800">
      <p className="text-xs font-medium text-zinc-500">{title}</p>
      <p className="mt-0.5 text-xs text-zinc-700 dark:text-zinc-300">{text}</p>
    </div>
  );
}

function LeadContacts({ parentId }: { parentId: string }) {
  const children = useChildItems(parentId);
  if (!children || children.length === 0) {
    return (
      <p className="mt-4 text-xs text-zinc-400">
        No contacts or outreach drafts for this lead.
      </p>
    );
  }

  const contacts = children.filter((c: any) => c.type === "contact");
  if (contacts.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        Contacts & Outreach
      </h4>
      {contacts.map((contact: any) => (
        <ContactCard key={contact._id} contact={contact} />
      ))}
    </div>
  );
}

function ContactCard({ contact }: { contact: any }) {
  const cd = contact.data as ContactData;
  const children = useChildItems(contact._id);
  const updateStatus = useMutation(api.agentItems.updateItemStatus);
  const drafts = children?.filter((c: any) => c.type === "outreach_draft") ?? [];

  return (
    <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
      {/* Contact header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {cd.name?.charAt(0) ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{cd.name}</span>
            {cd.linkedinUrl && (
              <a
                href={cd.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-xs text-blue-600 hover:underline"
              >
                <Link2 className="h-3 w-3" />
                Profile
              </a>
            )}
            {cd.email && (
              <a
                href={`mailto:${cd.email}`}
                className="flex items-center gap-0.5 text-xs text-amber-600 hover:underline"
              >
                <Mail className="h-3 w-3" />
                {cd.email}
              </a>
            )}
            {cd.phone && (
              <a
                href={`tel:${cd.phone}`}
                className="flex items-center gap-0.5 text-xs text-green-600 hover:underline"
              >
                <Phone className="h-3 w-3" />
                {cd.phone}
              </a>
            )}
          </div>
          <p className="text-xs text-zinc-500 truncate">{cd.title}</p>
        </div>
      </div>

      {/* Outreach drafts */}
      {drafts.length > 0 && (
        <div className="mt-2 space-y-1 pl-11">
          {drafts.map((draft: any) => {
            const dd = draft.data as OutreachDraftData;
            const channelIcon = dd.channel === "linkedin"
              ? <Link2 className="h-3 w-3 text-blue-500" />
              : dd.channel === "email"
                ? <Mail className="h-3 w-3 text-amber-500" />
                : <Globe className="h-3 w-3 text-green-500" />;

            return (
              <div
                key={draft._id}
                className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-1.5 text-sm dark:bg-zinc-900"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {channelIcon}
                  <span className="truncate">{draft.title}</span>
                  {dd.messageScore && (
                    <span className="text-xs text-zinc-400">
                      {dd.messageScore.total}/100
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-zinc-400 capitalize">{draft.status}</span>
                  {draft.status === "new" && (
                    <>
                      <button
                        onClick={() => updateStatus({ itemId: draft._id as Id<"agentItems">, status: "approved" })}
                        className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 hover:bg-green-200"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateStatus({ itemId: draft._id as Id<"agentItems">, status: "skipped" })}
                        className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
                      >
                        Skip
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
