# Outreach CRM UI Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add contact-level stage pipeline with next-step recommendations, company-level outreach funnel with auto-status, and colorful visual styling to the Outreach CRM.

**Architecture:** Pure frontend — all data already exists in Convex (messages, contacts, companies). We add derived state computation in `utils.ts`, new visual components (`stage-pipeline.tsx`, `outreach-funnel.tsx`, `next-step-banner.tsx`), and restyle `company-card.tsx` and `contact-card.tsx`. No backend changes needed.

**Tech Stack:** React, Tailwind CSS (dark mode), Convex (read-only — existing queries), lucide-react icons.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `web/app/(app)/outreach-tracker/types.ts` | Modify | Add `ContactStage`, `NextStep`, `CompanyOutreachStatus` types |
| `web/app/(app)/outreach-tracker/utils.ts` | Modify | Add `deriveContactStage()`, `deriveNextStep()`, `deriveCompanyOutreachStatus()`, `computeOutreachFunnel()` |
| `web/app/(app)/outreach-tracker/stage-pipeline.tsx` | Create | Horizontal stage dots component for contacts |
| `web/app/(app)/outreach-tracker/next-step-banner.tsx` | Create | Next action banner with urgency coloring |
| `web/app/(app)/outreach-tracker/outreach-funnel.tsx` | Create | Company-level funnel summary badges |
| `web/app/(app)/outreach-tracker/contact-card.tsx` | Modify | Integrate stage pipeline + next step banner into collapsed/expanded views |
| `web/app/(app)/outreach-tracker/company-card.tsx` | Modify | Add outreach funnel, colored left border, auto-status badge, load messages for funnel |
| `web/hooks/use-outreach-tracker.ts` | Modify | Add `useOutreachMessagesByCompany()` hook |

---

### Task 1: Add Types for Stage, Next Step, and Company Outreach Status

**Files:**
- Modify: `web/app/(app)/outreach-tracker/types.ts`

- [ ] **Step 1: Add new types at the end of types.ts**

Add after the `APPLIED_VIA_OPTIONS` export (line 218):

```typescript
// --- Contact Stage Pipeline ---

export type ContactStage =
  | "request_sent"
  | "accepted"
  | "dm_sent"
  | "replied"
  | "no_response";

export const STAGE_ORDER: ContactStage[] = [
  "request_sent",
  "accepted",
  "dm_sent",
  "replied",
];

export const STAGE_LABELS: Record<ContactStage, string> = {
  request_sent: "Request Sent",
  accepted: "Connected",
  dm_sent: "DM Sent",
  replied: "Replied",
  no_response: "No Response",
};

export const STAGE_COLORS: Record<ContactStage, string> = {
  request_sent: "text-blue-400 bg-blue-400",
  accepted: "text-green-400 bg-green-400",
  dm_sent: "text-purple-400 bg-purple-400",
  replied: "text-emerald-400 bg-emerald-400",
  no_response: "text-red-400 bg-red-400",
};

// --- Next Step Recommendation ---

export interface NextStep {
  action: string;
  dueLabel: string;
  urgency: "on_track" | "due_soon" | "overdue" | "done";
}

export const URGENCY_COLORS: Record<NextStep["urgency"], string> = {
  on_track: "bg-blue-500/10 border-blue-500/30 text-blue-300",
  due_soon: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  overdue: "bg-red-500/10 border-red-500/30 text-red-300",
  done: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
};

// --- Company Outreach Auto-Status ---

export type CompanyOutreachStatus =
  | "warming_up"
  | "needs_outreach"
  | "following_up"
  | "in_conversation"
  | "going_cold"
  | "done";

export const COMPANY_OUTREACH_LABELS: Record<CompanyOutreachStatus, string> = {
  warming_up: "Warming Up",
  needs_outreach: "Needs Outreach",
  following_up: "Following Up",
  in_conversation: "In Conversation",
  going_cold: "Going Cold",
  done: "Done",
};

export const COMPANY_OUTREACH_COLORS: Record<CompanyOutreachStatus, string> = {
  warming_up: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  needs_outreach: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  following_up: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  in_conversation: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  going_cold: "bg-red-500/20 text-red-300 border-red-500/30",
  done: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

export const COMPANY_BORDER_COLORS: Record<CompanyOutreachStatus, string> = {
  warming_up: "border-l-sky-500",
  needs_outreach: "border-l-blue-500",
  following_up: "border-l-amber-500",
  in_conversation: "border-l-emerald-500",
  going_cold: "border-l-red-500",
  done: "border-l-zinc-500",
};

export interface OutreachFunnel {
  reached: number;
  connected: number;
  dmed: number;
  replied: number;
  total: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/types.ts
git commit -m "feat(outreach): add types for contact stage pipeline, next step, company outreach status"
```

---

### Task 2: Add Derivation Functions to utils.ts

**Files:**
- Modify: `web/app/(app)/outreach-tracker/utils.ts`

- [ ] **Step 1: Add deriveContactStage function**

Add after the existing `daysOverdue` function (after line 35):

```typescript
import type {
  OutreachMessage,
  OutreachContact,
  ContactStage,
  NextStep,
  CompanyOutreachStatus,
  OutreachFunnel,
  ContactTier,
} from "./types";

export function deriveContactStage(
  messages: OutreachMessage[]
): ContactStage {
  const hasInbound = messages.some((m) => m.direction === "inbound");
  if (hasInbound) return "replied";

  const hasDm = messages.some(
    (m) => m.channel === "linkedin_dm" && m.direction === "outbound"
  );
  if (hasDm) return "dm_sent";

  const hasConnection = messages.some(
    (m) => m.channel === "linkedin_connection" && m.direction === "outbound"
  );

  // If we have a DM but it was a connection request channel, they accepted
  // (we sent a connection request and later sent a DM = accepted)
  if (hasConnection && hasDm) return "dm_sent";
  if (hasConnection) return "request_sent";

  // Email or whatsapp outbound counts as dm_sent equivalent
  const hasEmail = messages.some(
    (m) => m.channel === "email" && m.direction === "outbound"
  );
  if (hasEmail) return "dm_sent";

  return "request_sent";
}
```

- [ ] **Step 2: Add deriveNextStep function**

```typescript
export function deriveNextStep(
  stage: ContactStage,
  messages: OutreachMessage[],
  tier?: ContactTier
): NextStep {
  if (stage === "replied") {
    return { action: "In conversation", dueLabel: "", urgency: "done" };
  }

  const lastOutbound = messages
    .filter((m) => m.direction === "outbound")
    .sort((a, b) => b.sentAt - a.sentAt)[0];

  const daysSinceLast = lastOutbound
    ? Math.floor((Date.now() - lastOutbound.sentAt) / (1000 * 60 * 60 * 24))
    : 999;

  if (stage === "request_sent") {
    const isHighPriority = tier === "tier1" || tier === "tier2";
    if (isHighPriority) {
      if (daysSinceLast >= 1) {
        return {
          action: "Send InMail",
          dueLabel: daysSinceLast > 1 ? `${daysSinceLast - 1}d overdue` : "Due now",
          urgency: daysSinceLast > 1 ? "overdue" : "due_soon",
        };
      }
      return { action: "Send InMail", dueLabel: "Due tomorrow", urgency: "on_track" };
    }
    // Lower priority: wait longer
    if (daysSinceLast >= 3) {
      return {
        action: "Send follow-up request",
        dueLabel: `${daysSinceLast - 3}d overdue`,
        urgency: "overdue",
      };
    }
    return { action: "Waiting for acceptance", dueLabel: `${3 - daysSinceLast}d left`, urgency: "on_track" };
  }

  if (stage === "accepted") {
    return {
      action: "Send intro DM + resume",
      dueLabel: "Due now",
      urgency: "due_soon",
    };
  }

  if (stage === "dm_sent") {
    if (daysSinceLast >= 3) {
      return {
        action: "Send follow-up DM",
        dueLabel: `${daysSinceLast - 3}d overdue`,
        urgency: "overdue",
      };
    }
    if (daysSinceLast >= 2) {
      return {
        action: "Send follow-up DM",
        dueLabel: "Due tomorrow",
        urgency: "due_soon",
      };
    }
    return {
      action: "Waiting for reply",
      dueLabel: `${3 - daysSinceLast}d left`,
      urgency: "on_track",
    };
  }

  return { action: "Send connection request", dueLabel: "", urgency: "on_track" };
}
```

- [ ] **Step 3: Add computeOutreachFunnel and deriveCompanyOutreachStatus**

```typescript
export function computeOutreachFunnel(
  contactStages: ContactStage[]
): OutreachFunnel {
  const total = contactStages.length;
  const reached = total; // all contacts are "reached" by being added
  const connected = contactStages.filter(
    (s) => s === "accepted" || s === "dm_sent" || s === "replied"
  ).length;
  const dmed = contactStages.filter(
    (s) => s === "dm_sent" || s === "replied"
  ).length;
  const replied = contactStages.filter((s) => s === "replied").length;

  return { reached, connected, dmed, replied, total };
}

export function deriveCompanyOutreachStatus(
  funnel: OutreachFunnel,
  latestMessageAt: number | null
): CompanyOutreachStatus {
  if (funnel.total === 0) return "needs_outreach";
  if (funnel.replied > 0) return "in_conversation";

  const daysSinceActivity = latestMessageAt
    ? Math.floor((Date.now() - latestMessageAt) / (1000 * 60 * 60 * 24))
    : 999;

  if (daysSinceActivity > 5) return "going_cold";
  if (funnel.dmed > 0) return "following_up";
  if (funnel.connected > 0) return "needs_outreach";
  return "warming_up";
}
```

- [ ] **Step 4: Update the imports at the top of utils.ts**

Replace the existing import line:

```typescript
import type { OutreachStep, FollowUpReminder } from "./types";
```

with:

```typescript
import type {
  OutreachStep,
  FollowUpReminder,
  OutreachMessage,
  ContactStage,
  NextStep,
  CompanyOutreachStatus,
  OutreachFunnel,
  ContactTier,
} from "./types";
```

- [ ] **Step 5: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/utils.ts
git commit -m "feat(outreach): add stage derivation, next step logic, company funnel computation"
```

---

### Task 3: Create Stage Pipeline Component

**Files:**
- Create: `web/app/(app)/outreach-tracker/stage-pipeline.tsx`

- [ ] **Step 1: Create the StagePipeline component**

```tsx
"use client";

import type { ContactStage } from "./types";
import { STAGE_ORDER, STAGE_LABELS, STAGE_COLORS } from "./types";

interface StagePipelineProps {
  currentStage: ContactStage;
}

export function StagePipeline({ currentStage }: StagePipelineProps) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);

  return (
    <div className="flex items-center gap-0.5 w-full">
      {STAGE_ORDER.map((stage, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isFuture = i > currentIndex;
        const colorClass = STAGE_COLORS[stage];
        const [textColor, bgColor] = colorClass.split(" ");

        return (
          <div key={stage} className="flex items-center flex-1 min-w-0">
            {/* Dot */}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`relative flex h-3 w-3 items-center justify-center rounded-full ${
                  isCompleted
                    ? `${bgColor} ring-2 ring-offset-1 ring-offset-zinc-950 ring-${bgColor.replace("bg-", "")}`
                    : isCurrent
                      ? `${bgColor} ring-2 ring-offset-1 ring-offset-zinc-950 ring-${bgColor.replace("bg-", "")} animate-pulse`
                      : "bg-zinc-700 ring-1 ring-zinc-600"
                }`}
              >
                {isCompleted && (
                  <svg className="h-2 w-2 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span
                className={`text-[9px] font-medium whitespace-nowrap ${
                  isCurrent ? textColor : isCompleted ? "text-zinc-400" : "text-zinc-600"
                }`}
              >
                {STAGE_LABELS[stage]}
              </span>
            </div>

            {/* Connector line (not after last) */}
            {i < STAGE_ORDER.length - 1 && (
              <div
                className={`flex-1 h-px mx-1 ${
                  isCompleted
                    ? bgColor.replace("bg-", "bg-") + "/60"
                    : "bg-zinc-700 border-t border-dashed border-zinc-600"
                }`}
                style={
                  !isCompleted
                    ? {
                        backgroundImage: `repeating-linear-gradient(to right, rgb(82 82 91) 0, rgb(82 82 91) 4px, transparent 4px, transparent 8px)`,
                        backgroundSize: "8px 1px",
                        backgroundColor: "transparent",
                      }
                    : undefined
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/stage-pipeline.tsx
git commit -m "feat(outreach): create StagePipeline component with colored dots and connectors"
```

---

### Task 4: Create Next Step Banner Component

**Files:**
- Create: `web/app/(app)/outreach-tracker/next-step-banner.tsx`

- [ ] **Step 1: Create the NextStepBanner component**

```tsx
"use client";

import { ArrowRight, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import type { NextStep } from "./types";
import { URGENCY_COLORS } from "./types";

interface NextStepBannerProps {
  nextStep: NextStep;
}

const URGENCY_ICONS = {
  on_track: Clock,
  due_soon: Clock,
  overdue: AlertTriangle,
  done: CheckCircle2,
};

export function NextStepBanner({ nextStep }: NextStepBannerProps) {
  const colorClass = URGENCY_COLORS[nextStep.urgency];
  const Icon = URGENCY_ICONS[nextStep.urgency];

  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${colorClass}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="font-medium">{nextStep.action}</span>
      {nextStep.dueLabel && (
        <>
          <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
          <span className="opacity-75">{nextStep.dueLabel}</span>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/next-step-banner.tsx
git commit -m "feat(outreach): create NextStepBanner component with urgency colors"
```

---

### Task 5: Create Outreach Funnel Component

**Files:**
- Create: `web/app/(app)/outreach-tracker/outreach-funnel.tsx`

- [ ] **Step 1: Create the OutreachFunnelBar component**

```tsx
"use client";

import type { OutreachFunnel, CompanyOutreachStatus } from "./types";
import {
  COMPANY_OUTREACH_LABELS,
  COMPANY_OUTREACH_COLORS,
} from "./types";
import { Users, UserCheck, MessageSquare, MessageCircle } from "lucide-react";

interface OutreachFunnelBarProps {
  funnel: OutreachFunnel;
  outreachStatus: CompanyOutreachStatus;
}

export function OutreachFunnelBar({
  funnel,
  outreachStatus,
}: OutreachFunnelBarProps) {
  const stats = [
    { label: "Reached", value: funnel.reached, icon: Users, color: "text-blue-400" },
    { label: "Connected", value: funnel.connected, icon: UserCheck, color: "text-green-400" },
    { label: "DMed", value: funnel.dmed, icon: MessageSquare, color: "text-purple-400" },
    { label: "Replied", value: funnel.replied, icon: MessageCircle, color: "text-emerald-400" },
  ];

  const progressPercent =
    funnel.total > 0
      ? Math.round(
          ((funnel.connected + funnel.dmed * 2 + funnel.replied * 3) /
            (funnel.total * 3)) *
            100
        )
      : 0;

  return (
    <div className="flex items-center gap-3">
      {/* Funnel badges */}
      <div className="flex items-center gap-2">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="flex items-center gap-1 rounded-full bg-zinc-800/60 px-2 py-0.5"
          >
            <Icon className={`h-3 w-3 ${color}`} />
            <span className="text-[11px] font-semibold text-zinc-300">
              {value}
            </span>
            <span className="text-[10px] text-zinc-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Auto-status badge */}
      <span
        className={`ml-auto rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${COMPANY_OUTREACH_COLORS[outreachStatus]}`}
      >
        {COMPANY_OUTREACH_LABELS[outreachStatus]}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/outreach-funnel.tsx
git commit -m "feat(outreach): create OutreachFunnelBar with stats badges and auto-status"
```

---

### Task 6: Add useOutreachMessagesByCompany Hook

**Files:**
- Modify: `web/hooks/use-outreach-tracker.ts`

- [ ] **Step 1: Add the new hook at the end of the file**

Add after the existing `useJobCounts` function (after line 72):

```typescript
export function useOutreachMessagesByCompany(
  companyId: Id<"outreachCompanies"> | null
) {
  return useQuery(
    api.outreachMessages.listByCompany,
    companyId ? { companyId } : "skip"
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/hooks/use-outreach-tracker.ts
git commit -m "feat(outreach): add useOutreachMessagesByCompany hook"
```

---

### Task 7: Integrate Stage Pipeline + Next Step into Contact Card

**Files:**
- Modify: `web/app/(app)/outreach-tracker/contact-card.tsx`

This is the most complex task. We modify the contact card to:
1. Always load messages (not just when expanded) — needed for stage derivation
2. Show stage pipeline in collapsed view
3. Show next step banner below the pipeline
4. Improve visual styling

- [ ] **Step 1: Update imports**

Replace the existing imports (lines 1-35) with:

```tsx
"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";
import {
  useOutreachMessages,
  useOutreachGuidance,
  useFollowUpRemindersByContact,
} from "@/hooks/use-outreach-tracker";
import {
  BellOff,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Link2,
  Mail,
  Phone,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { OutreachContact } from "./types";
import {
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  GUIDANCE_CHANNELS,
  TIER_LABELS,
  TIER_COLORS,
} from "./types";
import { formatDate, isOverdue, deriveContactStage, deriveNextStep } from "./utils";
import { FollowUpBadge } from "./follow-up-badge";
import { StagePipeline } from "./stage-pipeline";
import { NextStepBanner } from "./next-step-banner";
import { LogMessageDialog } from "./log-message-dialog";
import type { Id } from "@/convex/_generated/dataModel";
```

- [ ] **Step 2: Always load messages (change from expanded-only to always)**

In the `ContactCard` function body, change line 52:

```tsx
// OLD: const messages = useOutreachMessages(expanded ? contact._id : null);
const messages = useOutreachMessages(contact._id);
```

- [ ] **Step 3: Add stage + next step derivation after the hooks**

After the existing `useAction` line (around line 60), add:

```tsx
const stage = messages ? deriveContactStage(messages) : null;
const nextStep = stage && messages ? deriveNextStep(stage, messages, contact.tier) : null;
```

- [ ] **Step 4: Replace the collapsed button content**

Replace the entire `<button>` element inside the card (lines 81-153) with this updated version that includes the stage pipeline and next step:

```tsx
<button
  onClick={() => setExpanded(!expanded)}
  className="flex w-full flex-col gap-2 p-3 text-left"
>
  <div className="flex w-full items-center gap-3">
    <span className="text-zinc-400">
      {expanded ? (
        <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" />
      )}
    </span>
    {(() => {
      const enrichedCount = [contact.email, contact.linkedinUrl, contact.phone].filter(Boolean).length;
      const ringClass = enrichedCount >= 3
        ? "ring-2 ring-green-400"
        : enrichedCount === 2
          ? "ring-2 ring-amber-400"
          : "";
      return contact.profilePictureUrl ? (
        <img
          src={contact.profilePictureUrl}
          alt={contact.name}
          className={`h-8 w-8 rounded-full object-cover ${ringClass}`}
        />
      ) : (
        <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 ${ringClass}`}>
          {contact.name.charAt(0)}
        </div>
      );
    })()}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{contact.name}</p>
        {activeReminder && <FollowUpBadge reminder={activeReminder} />}
      </div>
      {contact.title && (
        <p className="text-xs text-zinc-500">{contact.title}</p>
      )}
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {contact.linkedinUrl && (
        <a
          href={contact.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-blue-500 hover:text-blue-700"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      {contact.email && (
        <a
          href={`mailto:${contact.email}`}
          onClick={(e) => e.stopPropagation()}
          className="text-zinc-400 hover:text-zinc-600"
        >
          <Mail className="h-3.5 w-3.5" />
        </a>
      )}
      {contact.phone && (
        <Phone className="h-3.5 w-3.5 text-zinc-400" />
      )}
      <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
        {contact.source}
      </span>
      {contact.tier && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TIER_COLORS[contact.tier]}`}>
          {TIER_LABELS[contact.tier]}
        </span>
      )}
    </div>
  </div>
  {/* Stage pipeline + next step — always visible */}
  {stage && (
    <div className="flex w-full items-center gap-3 pl-8">
      <div className="flex-1">
        <StagePipeline currentStage={stage} />
      </div>
      {nextStep && (
        <div className="shrink-0">
          <NextStepBanner nextStep={nextStep} />
        </div>
      )}
    </div>
  )}
</button>
```

- [ ] **Step 5: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/contact-card.tsx
git commit -m "feat(outreach): integrate stage pipeline and next-step banner into contact card"
```

---

### Task 8: Add Outreach Funnel + Colored Border to Company Card

**Files:**
- Modify: `web/app/(app)/outreach-tracker/company-card.tsx`

- [ ] **Step 1: Update imports**

Replace the existing imports (lines 1-28) with:

```tsx
"use client";

import { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  useOutreachContacts,
  useOutreachSteps,
  useJobCounts,
  useOutreachMessagesByCompany,
} from "@/hooks/use-outreach-tracker";
import {
  ChevronDown,
  ChevronRight,
  Building2,
  Plus,
  Check,
  Circle,
  SkipForward,
  Trash2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import type { OutreachCompany, OutreachMessage } from "./types";
import { COMPANY_BORDER_COLORS } from "./types";
import {
  stepsProgress,
  deriveContactStage,
  computeOutreachFunnel,
  deriveCompanyOutreachStatus,
} from "./utils";
import { ContactCard } from "./contact-card";
import { AddContactDialog } from "./add-contact-dialog";
import { JobsTab } from "./jobs-tab";
import { PeopleTab } from "./people-tab";
import { OutreachFunnelBar } from "./outreach-funnel";
```

- [ ] **Step 2: Add messages query and funnel computation**

Inside the `CompanyCard` function body, after line 57 (`const jobCounts = ...`), add:

```tsx
// Always load contacts and messages for funnel computation
const allContacts = useOutreachContacts(company._id);
const companyMessages = useOutreachMessagesByCompany(company._id);

const { funnel, outreachStatus } = useMemo(() => {
  if (!allContacts || !companyMessages) {
    return {
      funnel: { reached: 0, connected: 0, dmed: 0, replied: 0, total: 0 },
      outreachStatus: "needs_outreach" as const,
    };
  }

  // Group messages by contact
  const messagesByContact = new Map<string, OutreachMessage[]>();
  for (const msg of companyMessages) {
    const existing = messagesByContact.get(msg.contactId) ?? [];
    existing.push(msg);
    messagesByContact.set(msg.contactId, existing);
  }

  const stages = allContacts.map((contact: any) => {
    const contactMessages = messagesByContact.get(contact._id) ?? [];
    return deriveContactStage(contactMessages);
  });

  const funnel = computeOutreachFunnel(stages);
  const latestMessage = companyMessages.length > 0
    ? Math.max(...companyMessages.map((m: any) => m.sentAt))
    : null;
  const outreachStatus = deriveCompanyOutreachStatus(funnel, latestMessage);

  return { funnel, outreachStatus };
}, [allContacts, companyMessages]);
```

- [ ] **Step 3: Update the existing contacts query to use allContacts**

Change the line that was:
```tsx
const contacts = useOutreachContacts(expanded ? company._id : null);
```
to:
```tsx
const contacts = allContacts;
```

Remove the duplicate `useOutreachContacts` call if it existed.

- [ ] **Step 4: Replace the outer card div with colored border**

Replace line 93:
```tsx
<div className="rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
```
with:
```tsx
<div className={`rounded-xl border border-zinc-200 border-l-4 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 ${COMPANY_BORDER_COLORS[outreachStatus]}`}>
```

- [ ] **Step 5: Add the outreach funnel bar between the header and the expanded section**

After the closing `</button>` of the header (around line 187), and before the `{expanded && (` line, add:

```tsx
{/* Outreach Funnel — always visible */}
{funnel.total > 0 && (
  <div className="border-t border-zinc-100 px-5 py-2.5 dark:border-zinc-800/50">
    <OutreachFunnelBar funnel={funnel} outreachStatus={outreachStatus} />
  </div>
)}
```

- [ ] **Step 6: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/company-card.tsx
git commit -m "feat(outreach): add outreach funnel, auto-status badge, and colored left border to company card"
```

---

### Task 9: Visual Polish — Improve Card Styling

**Files:**
- Modify: `web/app/(app)/outreach-tracker/company-card.tsx`
- Modify: `web/app/(app)/outreach-tracker/contact-card.tsx`
- Modify: `web/app/(app)/outreach-tracker/page.tsx`

- [ ] **Step 1: Update page.tsx header with gradient text**

In `page.tsx`, replace the `<h1>` (line 51):

```tsx
<h1 className="text-2xl font-semibold">
  Outreach Tracker ({companies.length})
</h1>
```

with:

```tsx
<h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
  Outreach Tracker
</h1>
<span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-sm font-semibold text-zinc-300">
  {companies.length}
</span>
```

- [ ] **Step 2: Update the status filter tabs with color accents**

In `page.tsx`, replace the filter tab button class (lines 115-119):

```tsx
className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
  tab === key
    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
}`}
```

with:

```tsx
className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
  tab === key
    ? key === "active"
      ? "bg-green-500/20 text-green-300 shadow-sm ring-1 ring-green-500/30"
      : key === "paused"
        ? "bg-amber-500/20 text-amber-300 shadow-sm ring-1 ring-amber-500/30"
        : key === "closed"
          ? "bg-zinc-500/20 text-zinc-300 shadow-sm ring-1 ring-zinc-500/30"
          : "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
}`}
```

- [ ] **Step 3: Improve company card header with bolder name and hover glow**

In `company-card.tsx`, update the company name h3 (line 123):

```tsx
<h3 className="text-base font-semibold">{company.name}</h3>
```

to:

```tsx
<h3 className="text-base font-bold tracking-tight">{company.name}</h3>
```

- [ ] **Step 4: Add hover glow effect to the outer company card div**

The outer card div (the one with colored border from Task 8 Step 4) — update it to:

```tsx
<div className={`rounded-xl border border-zinc-200 border-l-4 bg-white shadow-sm transition-all hover:shadow-lg hover:shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:shadow-zinc-100/5 ${COMPANY_BORDER_COLORS[outreachStatus]}`}>
```

- [ ] **Step 5: Improve contact card styling — add subtle gradient background**

In `contact-card.tsx`, replace the outer card div (line 80):

```tsx
<div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
```

with:

```tsx
<div className="rounded-lg border border-zinc-200 bg-zinc-50 transition-all hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-zinc-700">
```

- [ ] **Step 6: Commit**

```bash
git add web/app/\(app\)/outreach-tracker/page.tsx web/app/\(app\)/outreach-tracker/company-card.tsx web/app/\(app\)/outreach-tracker/contact-card.tsx
git commit -m "feat(outreach): visual polish — gradient header, colored filter tabs, hover effects"
```

---

### Task 10: Verify and Fix — Run Dev Server

- [ ] **Step 1: Run TypeScript check**

Run: `cd web && npx tsc --noEmit 2>&1 | head -50`

Fix any type errors.

- [ ] **Step 2: Start dev server and verify**

Run: `cd web && npm run dev`

Open `http://localhost:3000` and navigate to the Outreach Tracker page. Verify:
- Company cards have colored left borders (sky/blue/amber/emerald/red)
- Outreach funnel shows badge counts (Reached, Connected, DMed, Replied)
- Auto-status badge appears (Warming Up / Following Up / etc.)
- Contact cards show stage pipeline dots (Request Sent → Connected → DM Sent → Replied)
- Next step banners appear with correct urgency colors
- Gradient header text is visible
- Colored filter tabs work

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(outreach): resolve type errors and UI issues from integration"
```
