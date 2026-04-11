import type { JobLeadData, ContactData } from "@/lib/types";

export interface LeadItem {
  _id: string;
  status: string;
  data: JobLeadData;
  [key: string]: unknown;
}

export interface ContactItem {
  _id: string;
  status: string;
  type: string;
  data: ContactData;
  [key: string]: unknown;
}

export interface CompanyGroup {
  name: string;
  leads: LeadItem[];
  bestScore: number;
  fundingStage?: string;
  archetype?: string;
  description: string;
  location?: string;
  workModes: string[];
}

export type OutreachChannel =
  | "connection_request"
  | "first_message"
  | "email"
  | "whatsapp";

export type StatusFilter = "all" | "new" | "approved" | "skipped";

export const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "approved", label: "Approved" },
  { key: "skipped", label: "Skipped" },
];

export const SOURCE_LABELS: Record<string, string> = {
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

export const WORK_MODE_LABELS: Record<
  string,
  { label: string; color: string }
> = {
  remote: {
    label: "Remote",
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  hybrid: {
    label: "Hybrid",
    color:
      "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  },
  onsite: {
    label: "On-site",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  unknown: {
    label: "--",
    color:
      "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

export const SCORE_LABELS: Record<string, string> = {
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

export const BORDER_COLORS: string[] = [
  "border-l-violet-500",
  "border-l-blue-500",
  "border-l-emerald-500",
  "border-l-rose-500",
  "border-l-amber-500",
  "border-l-cyan-500",
  "border-l-pink-500",
  "border-l-indigo-500",
  "border-l-teal-500",
  "border-l-orange-500",
];

export const CHANNEL_OPTIONS: {
  key: OutreachChannel;
  label: string;
  description: string;
}[] = [
  {
    key: "connection_request",
    label: "Connection Request",
    description: "LinkedIn connection request (max 300 chars)",
  },
  {
    key: "first_message",
    label: "First Message",
    description: "LinkedIn DM for existing connections",
  },
  {
    key: "email",
    label: "Email",
    description: "Professional email outreach",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    description: "Short, casual WhatsApp message",
  },
];
