# Company Hub + LinkedIn Connection Tracker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `connectionRequests` table, a Companies list page, a Company detail page with unified view (applications, connections, next steps, timeline), and a CLI check-in mode for daily connection logging.

**Architecture:** Convex backend with new `connectionRequests` table + CRUD mutations/queries. Next.js frontend with two new routes (`/companies` list + `/companies/[id]` detail). A new `modes/checkin.md` for CLI-based daily connection logging. All data flows through Convex; the company detail page aggregates from `agentItems`, `connectionRequests`, `companies`, and `people` tables.

**Tech Stack:** Convex (backend), Next.js 16 (frontend), React 19, Tailwind CSS v4, Lucide React (icons), Clerk (auth)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `convex/schema.ts` | Add `connectionRequests` table definition |
| `convex/connectionRequests.ts` | CRUD mutations and queries for connection requests |
| `web/lib/types.ts` | Add `ConnectionRequestData` and `CompanyDetail` types |
| `web/hooks/use-connection-requests.ts` | React hook to fetch connection requests |
| `web/hooks/use-company-detail.ts` | React hook aggregating all company data |
| `web/app/(app)/companies/page.tsx` | Companies list page |
| `web/app/(app)/companies/[id]/page.tsx` | Company detail page (hub) |
| `web/components/connections/connection-card.tsx` | Single connection row component |
| `web/components/connections/quick-add-modal.tsx` | Modal for adding a new connection |
| `web/components/company/next-steps-panel.tsx` | Agent-generated next steps section |
| `web/components/company/activity-timeline.tsx` | Chronological activity feed |
| `web/components/company/applications-section.tsx` | Applications list within company detail |
| `web/components/layout/sidebar.tsx` | Add "Companies" nav item |
| `modes/checkin.md` | CLI check-in mode for daily connection logging |

---

## Task 1: Schema — Add `connectionRequests` table

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add the connectionRequests table to the schema**

Open `convex/schema.ts` and add this table definition inside `defineSchema({})`, after the `outreachStrategies` table (around line 216):

```typescript
  connectionRequests: defineTable({
    agentId: v.id("agents"),
    personId: v.id("people"),
    companyId: v.id("companies"),
    contactRole: v.string(),
    contactType: v.union(
      v.literal("recruiter"),
      v.literal("hiring_manager"),
      v.literal("peer"),
      v.literal("founder"),
      v.literal("executive"),
      v.literal("other")
    ),
    sentDate: v.number(),
    status: v.union(
      v.literal("suggested"),
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("ignored")
    ),
    noteWithRequest: v.boolean(),
    messageSent: v.boolean(),
    messageDate: v.optional(v.number()),
    linkedToLeadId: v.optional(v.id("agentItems")),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_company", ["companyId"])
    .index("by_agent_and_status", ["agentId", "status"])
    .index("by_agent_and_company", ["agentId", "companyId"]),
```

- [ ] **Step 2: Verify schema compiles**

Run: `cd /Users/apoorva1509/conductor/workspaces/career-ops-v1/montevideo && npx convex dev --once`

Expected: Schema synced successfully, no errors.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add connectionRequests table to Convex schema"
```

---

## Task 2: Backend — Connection request CRUD

**Files:**
- Create: `convex/connectionRequests.ts`

- [ ] **Step 1: Create the connectionRequests module with validators and queries**

Create `convex/connectionRequests.ts`:

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePerson } from "./helpers/auth";

const contactTypeValidator = v.union(
  v.literal("recruiter"),
  v.literal("hiring_manager"),
  v.literal("peer"),
  v.literal("founder"),
  v.literal("executive"),
  v.literal("other")
);

const connectionStatusValidator = v.union(
  v.literal("suggested"),
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("ignored")
);

export const getByAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    return await ctx.db
      .query("connectionRequests")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .order("desc")
      .take(500);
  },
});

export const getByCompany = query({
  args: { agentId: v.id("agents"), companyId: v.id("companies") },
  handler: async (ctx, { agentId, companyId }) => {
    return await ctx.db
      .query("connectionRequests")
      .withIndex("by_agent_and_company", (q) =>
        q.eq("agentId", agentId).eq("companyId", companyId)
      )
      .order("desc")
      .collect();
  },
});

export const getByStatus = query({
  args: { agentId: v.id("agents"), status: connectionStatusValidator },
  handler: async (ctx, { agentId, status }) => {
    return await ctx.db
      .query("connectionRequests")
      .withIndex("by_agent_and_status", (q) =>
        q.eq("agentId", agentId).eq("status", status)
      )
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    agentId: v.id("agents"),
    personId: v.id("people"),
    companyId: v.id("companies"),
    contactRole: v.string(),
    contactType: contactTypeValidator,
    sentDate: v.number(),
    status: connectionStatusValidator,
    noteWithRequest: v.boolean(),
    messageSent: v.boolean(),
    messageDate: v.optional(v.number()),
    linkedToLeadId: v.optional(v.id("agentItems")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("connectionRequests", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    requestId: v.id("connectionRequests"),
    status: connectionStatusValidator,
  },
  handler: async (ctx, { requestId, status }) => {
    await requirePerson(ctx);
    await ctx.db.patch(requestId, { status, updatedAt: Date.now() });
  },
});

export const markMessageSent = mutation({
  args: {
    requestId: v.id("connectionRequests"),
  },
  handler: async (ctx, { requestId }) => {
    await requirePerson(ctx);
    await ctx.db.patch(requestId, {
      messageSent: true,
      messageDate: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    requestId: v.id("connectionRequests"),
    contactRole: v.optional(v.string()),
    contactType: v.optional(contactTypeValidator),
    noteWithRequest: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    linkedToLeadId: v.optional(v.id("agentItems")),
  },
  handler: async (ctx, { requestId, ...fields }) => {
    await requirePerson(ctx);
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(requestId, updates);
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/apoorva1509/conductor/workspaces/career-ops-v1/montevideo && npx convex dev --once`

Expected: No errors, `connectionRequests` functions registered.

- [ ] **Step 3: Commit**

```bash
git add convex/connectionRequests.ts
git commit -m "feat: add connectionRequests CRUD mutations and queries"
```

---

## Task 3: Types — Add frontend type definitions

**Files:**
- Modify: `web/lib/types.ts`

- [ ] **Step 1: Add ConnectionRequestData and CompanyDetail types**

Append to the end of `web/lib/types.ts`:

```typescript
export type ConnectionContactType =
  | "recruiter"
  | "hiring_manager"
  | "peer"
  | "founder"
  | "executive"
  | "other";

export type ConnectionStatus =
  | "suggested"
  | "pending"
  | "accepted"
  | "ignored";

export interface ConnectionRequestData {
  contactRole: string;
  contactType: ConnectionContactType;
  sentDate: number;
  status: ConnectionStatus;
  noteWithRequest: boolean;
  messageSent: boolean;
  messageDate?: number;
  notes?: string;
}

export interface CompanySummary {
  _id: string;
  name: string;
  domain: string;
  logoUrl?: string;
  city?: string;
  country?: string;
  employees?: number;
  industries?: string[];
  leadsCount: number;
  connectionsCount: number;
  acceptedCount: number;
  latestStatus: string;
  lastActivityAt: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/types.ts
git commit -m "feat: add connection request and company summary types"
```

---

## Task 4: Hooks — Connection requests and company detail

**Files:**
- Create: `web/hooks/use-connection-requests.ts`
- Create: `web/hooks/use-company-detail.ts`

- [ ] **Step 1: Create the connection requests hook**

Create `web/hooks/use-connection-requests.ts`:

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";
import type { Id } from "@/convex/_generated/dataModel";

export function useConnectionRequests() {
  const { activeAgent } = useAgent();

  return useQuery(
    api.connectionRequests.getByAgent,
    activeAgent ? { agentId: activeAgent._id } : "skip"
  );
}

export function useConnectionsByCompany(companyId: Id<"companies"> | null) {
  const { activeAgent } = useAgent();

  return useQuery(
    api.connectionRequests.getByCompany,
    activeAgent && companyId
      ? { agentId: activeAgent._id, companyId }
      : "skip"
  );
}

export function usePendingConnections() {
  const { activeAgent } = useAgent();

  return useQuery(
    api.connectionRequests.getByStatus,
    activeAgent
      ? { agentId: activeAgent._id, status: "pending" as const }
      : "skip"
  );
}
```

- [ ] **Step 2: Create the company detail hook**

Create `web/hooks/use-company-detail.ts`:

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";
import type { Id } from "@/convex/_generated/dataModel";

export function useCompanyDetail(companyId: Id<"companies"> | null) {
  const { activeAgent } = useAgent();

  const connections = useQuery(
    api.connectionRequests.getByCompany,
    activeAgent && companyId
      ? { agentId: activeAgent._id, companyId }
      : "skip"
  );

  const allLeads = useQuery(
    api.agentItems.getItemsByType,
    activeAgent
      ? { agentId: activeAgent._id, type: "job_lead" as const }
      : "skip"
  );

  const allDrafts = useQuery(
    api.agentItems.getItemsByType,
    activeAgent
      ? { agentId: activeAgent._id, type: "outreach_draft" as const }
      : "skip"
  );

  const companyLeads = allLeads?.filter(
    (l: any) => l.companyId === companyId
  );

  const companyDrafts = allDrafts?.filter(
    (d: any) => d.companyId === companyId
  );

  const isLoading =
    connections === undefined ||
    allLeads === undefined ||
    allDrafts === undefined;

  return { connections, leads: companyLeads, drafts: companyDrafts, isLoading };
}
```

- [ ] **Step 3: Commit**

```bash
git add web/hooks/use-connection-requests.ts web/hooks/use-company-detail.ts
git commit -m "feat: add hooks for connection requests and company detail"
```

---

## Task 5: Sidebar — Add Companies nav item

**Files:**
- Modify: `web/components/layout/sidebar.tsx`

- [ ] **Step 1: Add Companies to NAV_ITEMS**

In `web/components/layout/sidebar.tsx`, add `Building2` to the lucide import:

```typescript
import {
  Briefcase,
  User,
  Send,
  FileText,
  Play,
  Settings,
  LayoutDashboard,
  Building2,
} from "lucide-react";
```

Then add the Companies item to `NAV_ITEMS`, after the Leads entry:

```typescript
const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/leads", label: "Leads", icon: Briefcase },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/outreach", label: "Outreach", icon: Send },
  { href: "/resumes", label: "Resumes", icon: FileText },
  { href: "/pipeline", label: "Pipeline", icon: Play },
  { href: "/settings", label: "Settings", icon: Settings },
];
```

- [ ] **Step 2: Commit**

```bash
git add web/components/layout/sidebar.tsx
git commit -m "feat: add Companies nav item to sidebar"
```

---

## Task 6: Companies List Page

**Files:**
- Create: `web/app/(app)/companies/page.tsx`

- [ ] **Step 1: Create the companies list page**

Create `web/app/(app)/companies/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";
import { useConnectionRequests } from "@/hooks/use-connection-requests";
import { useAgentItems } from "@/hooks/use-agent-items";
import Link from "next/link";
import { Building2, Users, Briefcase, ChevronRight } from "lucide-react";

type FilterTab = "all" | "active" | "archived";

export default function CompaniesPage() {
  const { activeAgent } = useAgent();
  const connections = useConnectionRequests();
  const leads = useAgentItems("job_lead");
  const [tab, setTab] = useState<FilterTab>("all");

  if (!activeAgent) {
    return <p className="text-zinc-500">Select an agent first.</p>;
  }

  if (connections === undefined || leads === undefined) {
    return <p className="text-zinc-500">Loading companies...</p>;
  }

  // Build company map from connections + leads
  const companyMap = new Map<
    string,
    {
      companyId: string;
      name: string;
      leadsCount: number;
      connectionsCount: number;
      acceptedCount: number;
      pendingCount: number;
      lastActivityAt: number;
      hasActiveWork: boolean;
    }
  >();

  for (const conn of connections) {
    const id = conn.companyId;
    const existing = companyMap.get(id) ?? {
      companyId: id,
      name: "",
      leadsCount: 0,
      connectionsCount: 0,
      acceptedCount: 0,
      pendingCount: 0,
      lastActivityAt: 0,
      hasActiveWork: false,
    };
    existing.connectionsCount++;
    if (conn.status === "accepted") existing.acceptedCount++;
    if (conn.status === "pending") {
      existing.pendingCount++;
      existing.hasActiveWork = true;
    }
    if (conn.updatedAt > existing.lastActivityAt) {
      existing.lastActivityAt = conn.updatedAt;
    }
    companyMap.set(id, existing);
  }

  for (const lead of leads) {
    if (!lead.companyId) continue;
    const id = lead.companyId;
    const existing = companyMap.get(id) ?? {
      companyId: id,
      name: "",
      leadsCount: 0,
      connectionsCount: 0,
      acceptedCount: 0,
      pendingCount: 0,
      lastActivityAt: 0,
      hasActiveWork: false,
    };
    existing.leadsCount++;
    if (lead.data?.company) existing.name = lead.data.company;
    if (
      lead.status === "new" ||
      lead.status === "approved" ||
      lead.status === "actioned"
    ) {
      existing.hasActiveWork = true;
    }
    if (lead.updatedAt > existing.lastActivityAt) {
      existing.lastActivityAt = lead.updatedAt;
    }
    companyMap.set(id, existing);
  }

  const companies = Array.from(companyMap.values()).sort(
    (a, b) => b.lastActivityAt - a.lastActivityAt
  );

  const filtered =
    tab === "all"
      ? companies
      : tab === "active"
        ? companies.filter((c) => c.hasActiveWork)
        : companies.filter((c) => !c.hasActiveWork);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Companies ({companies.length})</h1>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
        {(["all", "active", "archived"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Company list */}
      {filtered.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          No companies found.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((company) => (
            <Link
              key={company.companyId}
              href={`/companies/${company.companyId}`}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-5 py-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <Building2 className="h-5 w-5 text-zinc-500" />
                </div>
                <div>
                  <p className="font-medium">
                    {company.name || company.companyId}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {company.leadsCount} lead{company.leadsCount !== 1 && "s"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {company.connectionsCount} connection{company.connectionsCount !== 1 && "s"}
                      {company.acceptedCount > 0 && (
                        <span className="text-green-600">
                          ({company.acceptedCount} acc.)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {company.pendingCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {company.pendingCount} pending
                  </span>
                )}
                <span className="text-xs text-zinc-400">
                  {formatTimeAgo(company.lastActivityAt)}
                </span>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
```

- [ ] **Step 2: Verify it renders**

Run the dev server: `cd /Users/apoorva1509/conductor/workspaces/career-ops-v1/montevideo/web && npm run dev`

Navigate to `http://localhost:3000/companies`. Expected: page renders with "Companies (0)" header and empty state.

- [ ] **Step 3: Commit**

```bash
git add web/app/\(app\)/companies/page.tsx
git commit -m "feat: add companies list page with connection/lead aggregation"
```

---

## Task 7: Connection Card Component

**Files:**
- Create: `web/components/connections/connection-card.tsx`

- [ ] **Step 1: Create the connection card component**

Create `web/components/connections/connection-card.tsx`:

```typescript
"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { MessageSquare, AlertTriangle, Check, Clock, UserPlus } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  recruiter: "Recruiter",
  hiring_manager: "Hiring Mgr",
  peer: "Peer",
  founder: "Founder",
  executive: "Executive",
  other: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  suggested: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  ignored: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};

interface ConnectionCardProps {
  connection: any;
  personName?: string;
}

export function ConnectionCard({ connection, personName }: ConnectionCardProps) {
  const updateStatus = useMutation(api.connectionRequests.updateStatus);
  const markSent = useMutation(api.connectionRequests.markMessageSent);

  const daysPending =
    connection.status === "pending"
      ? Math.floor((Date.now() - connection.sentDate) / 86400000)
      : 0;

  const needsFollowUp =
    connection.status === "pending" &&
    !connection.noteWithRequest &&
    !connection.messageSent &&
    daysPending >= 3;

  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <UserPlus className="h-4 w-4 text-zinc-500" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {personName ?? "Unknown"}
            </span>
            <span className="text-xs text-zinc-500">
              {connection.contactRole}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                TYPE_LABELS[connection.contactType]
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : ""
              }`}
            >
              {TYPE_LABELS[connection.contactType] ?? connection.contactType}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Sent {new Date(connection.sentDate).toLocaleDateString()}</span>
            {connection.noteWithRequest && (
              <span className="flex items-center gap-0.5">
                <MessageSquare className="h-3 w-3" /> Note sent
              </span>
            )}
            {connection.messageSent && (
              <span className="flex items-center gap-0.5">
                <Check className="h-3 w-3 text-green-500" /> Messaged
              </span>
            )}
            {needsFollowUp && (
              <span className="flex items-center gap-0.5 text-amber-600">
                <AlertTriangle className="h-3 w-3" /> No note — {daysPending}d pending
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            STATUS_STYLES[connection.status] ?? ""
          }`}
        >
          {connection.status}
        </span>

        {connection.status === "pending" && (
          <div className="flex gap-1">
            <button
              onClick={() =>
                updateStatus({
                  requestId: connection._id as Id<"connectionRequests">,
                  status: "accepted",
                })
              }
              className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
            >
              Accepted
            </button>
            {!connection.messageSent && (
              <button
                onClick={() =>
                  markSent({
                    requestId: connection._id as Id<"connectionRequests">,
                  })
                }
                className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                Msg Sent
              </button>
            )}
          </div>
        )}

        {connection.status === "suggested" && (
          <button
            onClick={() =>
              updateStatus({
                requestId: connection._id as Id<"connectionRequests">,
                status: "pending",
              })
            }
            className="rounded bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
          >
            Reached Out
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/connections/connection-card.tsx
git commit -m "feat: add ConnectionCard component with status actions"
```

---

## Task 8: Quick-Add Modal

**Files:**
- Create: `web/components/connections/quick-add-modal.tsx`

- [ ] **Step 1: Create the quick-add modal**

Create `web/components/connections/quick-add-modal.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAgent } from "@/components/providers/agent-provider";
import type { Id } from "@/convex/_generated/dataModel";
import { X } from "lucide-react";

const CONTACT_TYPES = [
  { value: "recruiter", label: "Recruiter" },
  { value: "hiring_manager", label: "Hiring Manager" },
  { value: "peer", label: "Peer" },
  { value: "founder", label: "Founder" },
  { value: "executive", label: "Executive" },
  { value: "other", label: "Other" },
] as const;

interface QuickAddModalProps {
  companyId: Id<"companies">;
  onClose: () => void;
}

export function QuickAddModal({ companyId, onClose }: QuickAddModalProps) {
  const { activeAgent } = useAgent();
  const createConnection = useMutation(api.connectionRequests.create);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [contactType, setContactType] = useState<string>("recruiter");
  const [noteSent, setNoteSent] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAgent || !name.trim()) return;

    setSaving(true);

    // Create person first, then connection
    // For now, we pass a placeholder personId
    // In production, we'd create or find the person first
    // This will be wired up when the people creation mutation is available

    // Create a person record
    const personId = await createPersonIfNeeded(name.trim());

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

    setSaving(false);
    onClose();
  };

  // Placeholder — will need a people.create mutation
  async function createPersonIfNeeded(_name: string): Promise<Id<"people">> {
    // TODO: Wire up to people.create or people.findOrCreate mutation
    // For now this is a compile placeholder — Task 9 addresses this
    throw new Error("Not implemented — see Task 9");
  }

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
```

- [ ] **Step 2: Commit**

```bash
git add web/components/connections/quick-add-modal.tsx
git commit -m "feat: add quick-add modal for new connections"
```

---

## Task 9: People findOrCreate mutation

The quick-add modal needs to create `people` records. The existing `people` table has no create mutation exposed.

**Files:**
- Create: `convex/people.ts` (if it doesn't exist, or modify if it does)

- [ ] **Step 1: Check if convex/people.ts exists**

Run: `ls -la /Users/apoorva1509/conductor/workspaces/career-ops-v1/montevideo/convex/people.ts 2>/dev/null || echo "not found"`

If not found, create it. If found, add the `findOrCreate` mutation.

- [ ] **Step 2: Create convex/people.ts with findOrCreate**

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const findOrCreate = mutation({
  args: {
    name: v.string(),
    linkedinUrl: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { name, linkedinUrl, email }) => {
    // Try to find by LinkedIn URL first
    if (linkedinUrl) {
      const existing = await ctx.db
        .query("people")
        .withIndex("by_linkedin", (q) => q.eq("linkedinUrl", linkedinUrl))
        .first();
      if (existing) return existing._id;
    }

    // Try to find by email
    if (email) {
      const existing = await ctx.db
        .query("people")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (existing) return existing._id;
    }

    // Create new person
    return await ctx.db.insert("people", {
      name,
      linkedinUrl,
      email,
      source: "manual",
      updatedAt: Date.now(),
    });
  },
});

export const getById = query({
  args: { personId: v.id("people") },
  handler: async (ctx, { personId }) => {
    return await ctx.db.get(personId);
  },
});
```

- [ ] **Step 3: Wire up the quick-add modal to use findOrCreate**

In `web/components/connections/quick-add-modal.tsx`, replace the `createPersonIfNeeded` function:

```typescript
  const findOrCreatePerson = useMutation(api.people.findOrCreate);

  // Remove the old createPersonIfNeeded function and update handleSubmit:
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAgent || !name.trim()) return;

    setSaving(true);

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

    setSaving(false);
    onClose();
  };
```

Remove the old `createPersonIfNeeded` function entirely.

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/apoorva1509/conductor/workspaces/career-ops-v1/montevideo && npx convex dev --once`

- [ ] **Step 5: Commit**

```bash
git add convex/people.ts web/components/connections/quick-add-modal.tsx
git commit -m "feat: add people findOrCreate mutation, wire up quick-add modal"
```

---

## Task 10: Company Detail Page — Next Steps Panel

**Files:**
- Create: `web/components/company/next-steps-panel.tsx`

- [ ] **Step 1: Create the next steps panel**

Create `web/components/company/next-steps-panel.tsx`:

```typescript
"use client";

import { AlertTriangle, MessageSquare, Send, CheckCircle } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface NextStep {
  id: string;
  type: "follow_up" | "send_message" | "thank_accepted";
  connectionId: Id<"connectionRequests">;
  personName: string;
  description: string;
  urgency: number; // days pending
}

interface NextStepsPanelProps {
  connections: any[];
  people: Map<string, string>; // personId -> name
}

export function NextStepsPanel({ connections, people }: NextStepsPanelProps) {
  const updateStatus = useMutation(api.connectionRequests.updateStatus);
  const markSent = useMutation(api.connectionRequests.markMessageSent);

  const steps: NextStep[] = [];

  for (const conn of connections) {
    const personName = people.get(conn.personId) ?? "Unknown";
    const daysPending = Math.floor((Date.now() - conn.sentDate) / 86400000);

    // Pending + no note + no message + 3+ days = needs follow-up
    if (
      conn.status === "pending" &&
      !conn.noteWithRequest &&
      !conn.messageSent &&
      daysPending >= 3
    ) {
      steps.push({
        id: `followup-${conn._id}`,
        type: "follow_up",
        connectionId: conn._id,
        personName,
        description: `Follow up with ${personName} — pending ${daysPending}d, no note sent`,
        urgency: daysPending,
      });
    }

    // Accepted + no message sent = send thank you
    if (conn.status === "accepted" && !conn.messageSent) {
      steps.push({
        id: `thank-${conn._id}`,
        type: "thank_accepted",
        connectionId: conn._id,
        personName,
        description: `${personName} accepted — send a thank you / intro message`,
        urgency: 1,
      });
    }
  }

  steps.sort((a, b) => b.urgency - a.urgency);

  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4" />
        Next Steps ({steps.length})
      </h3>
      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex items-center justify-between rounded-md bg-white px-3 py-2 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2 text-sm">
              {step.type === "follow_up" ? (
                <Send className="h-4 w-4 text-amber-600" />
              ) : (
                <MessageSquare className="h-4 w-4 text-green-600" />
              )}
              <span>{step.description}</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() =>
                  markSent({ requestId: step.connectionId })
                }
                className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                Mark Done
              </button>
              <button
                onClick={() =>
                  updateStatus({
                    requestId: step.connectionId,
                    status: "ignored",
                  })
                }
                className="rounded bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
              >
                Skip
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/company/next-steps-panel.tsx
git commit -m "feat: add NextStepsPanel component for agent-generated follow-ups"
```

---

## Task 11: Company Detail Page — Applications Section

**Files:**
- Create: `web/components/company/applications-section.tsx`

- [ ] **Step 1: Create the applications section**

Create `web/components/company/applications-section.tsx`:

```typescript
"use client";

import { Briefcase, FileText, ExternalLink } from "lucide-react";
import type { JobLeadData } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  actioned: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  done: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  skipped: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};

interface ApplicationsSectionProps {
  leads: any[];
}

export function ApplicationsSection({ leads }: ApplicationsSectionProps) {
  if (leads.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Briefcase className="h-4 w-4" />
          Applications
        </h3>
        <p className="text-sm text-zinc-500">No applications yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Briefcase className="h-4 w-4" />
        Applications ({leads.length})
      </h3>
      <div className="space-y-2">
        {leads.map((lead: any) => {
          const d = lead.data as JobLeadData;
          return (
            <div
              key={lead._id}
              className="flex items-center justify-between rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
            >
              <div>
                <p className="text-sm font-medium">{d.role}</p>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>
                    {new Date(lead.updatedAt).toLocaleDateString()}
                  </span>
                  {d.matchScore !== undefined && (
                    <span
                      className={`font-semibold ${
                        d.matchScore >= 80
                          ? "text-green-600"
                          : d.matchScore >= 60
                            ? "text-amber-600"
                            : "text-red-500"
                      }`}
                    >
                      {d.matchScore}/100
                    </span>
                  )}
                  {d.workMode && (
                    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                      {d.workMode}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    STATUS_COLORS[lead.status] ?? ""
                  }`}
                >
                  {lead.status}
                </span>
                {d.url && (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-zinc-600"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/company/applications-section.tsx
git commit -m "feat: add ApplicationsSection component for company detail"
```

---

## Task 12: Company Detail Page — Activity Timeline

**Files:**
- Create: `web/components/company/activity-timeline.tsx`

- [ ] **Step 1: Create the activity timeline**

Create `web/components/company/activity-timeline.tsx`:

```typescript
"use client";

import { Clock, UserPlus, Send, Briefcase, MessageSquare } from "lucide-react";

interface TimelineEvent {
  date: number;
  icon: "connection" | "message" | "application" | "outreach";
  description: string;
}

interface ActivityTimelineProps {
  connections: any[];
  leads: any[];
  drafts: any[];
  people: Map<string, string>;
}

const ICONS = {
  connection: UserPlus,
  message: MessageSquare,
  application: Briefcase,
  outreach: Send,
};

export function ActivityTimeline({
  connections,
  leads,
  drafts,
  people,
}: ActivityTimelineProps) {
  const events: TimelineEvent[] = [];

  for (const conn of connections) {
    const name = people.get(conn.personId) ?? "Unknown";
    events.push({
      date: conn.sentDate,
      icon: "connection",
      description: `Connection request sent to ${name} (${conn.contactRole})${
        conn.noteWithRequest ? " with note" : ""
      }`,
    });
    if (conn.messageSent && conn.messageDate) {
      events.push({
        date: conn.messageDate,
        icon: "message",
        description: `Follow-up message sent to ${name}`,
      });
    }
  }

  for (const lead of leads) {
    events.push({
      date: lead.updatedAt,
      icon: "application",
      description: `${lead.data?.role ?? "Role"} — ${lead.status}`,
    });
  }

  for (const draft of drafts) {
    events.push({
      date: draft.updatedAt,
      icon: "outreach",
      description: `Outreach draft: ${draft.title} (${draft.status})`,
    });
  }

  events.sort((a, b) => b.date - a.date);

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Clock className="h-4 w-4" />
        Activity Timeline
      </h3>
      <div className="space-y-2">
        {events.slice(0, 20).map((event, i) => {
          const Icon = ICONS[event.icon];
          return (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <Icon className="h-3 w-3 text-zinc-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {event.description}
                </p>
                <p className="text-xs text-zinc-400">
                  {new Date(event.date).toLocaleDateString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/company/activity-timeline.tsx
git commit -m "feat: add ActivityTimeline component for company detail"
```

---

## Task 13: Company Detail Page — Main Page

**Files:**
- Create: `web/app/(app)/companies/[id]/page.tsx`

- [ ] **Step 1: Create the company detail page**

Create `web/app/(app)/companies/[id]/page.tsx`:

```typescript
"use client";

import { use, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompanyDetail } from "@/hooks/use-company-detail";
import { useAgent } from "@/components/providers/agent-provider";
import { NextStepsPanel } from "@/components/company/next-steps-panel";
import { ApplicationsSection } from "@/components/company/applications-section";
import { ConnectionCard } from "@/components/connections/connection-card";
import { QuickAddModal } from "@/components/connections/quick-add-modal";
import { ActivityTimeline } from "@/components/company/activity-timeline";
import {
  ArrowLeft,
  Building2,
  Users,
  Plus,
  MapPin,
  Globe,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";

export default function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const companyId = id as Id<"companies">;
  const { activeAgent } = useAgent();
  const { connections, leads, drafts, isLoading } =
    useCompanyDetail(companyId);
  const company = useQuery(api.agentItems.getAgentItems, 
    activeAgent ? { agentId: activeAgent._id } : "skip"
  );

  const [showAddModal, setShowAddModal] = useState(false);
  const [showIntel, setShowIntel] = useState(false);

  if (!activeAgent) {
    return <p className="text-zinc-500">Select an agent first.</p>;
  }

  if (isLoading) {
    return <p className="text-zinc-500">Loading company details...</p>;
  }

  // Build people name map from connections
  const peopleMap = new Map<string, string>();
  // We'll need to fetch people names — for now use personId as fallback
  // This gets resolved when we add a bulk people query

  // Derive company name from leads data
  const companyName =
    leads?.[0]?.data?.company ?? companyId;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/companies"
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
          <Building2 className="h-5 w-5 text-zinc-500" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{companyName}</h1>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>{leads?.length ?? 0} lead{(leads?.length ?? 0) !== 1 && "s"}</span>
            <span>-</span>
            <span>
              {connections?.length ?? 0} connection{(connections?.length ?? 0) !== 1 && "s"}
            </span>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      {connections && connections.length > 0 && (
        <NextStepsPanel connections={connections} people={peopleMap} />
      )}

      {/* Applications */}
      <ApplicationsSection leads={leads ?? []} />

      {/* Connections */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" />
            Connections ({connections?.length ?? 0})
          </h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
        {connections && connections.length > 0 ? (
          <div className="space-y-1.5">
            {connections.map((conn: any) => (
              <ConnectionCard
                key={conn._id}
                connection={conn}
                personName={peopleMap.get(conn.personId)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No connections yet.</p>
        )}
      </div>

      {/* Activity Timeline */}
      {connections && leads && drafts && (
        <ActivityTimeline
          connections={connections}
          leads={leads}
          drafts={drafts}
          people={peopleMap}
        />
      )}

      {/* Company Intel (collapsed) */}
      <button
        onClick={() => setShowIntel(!showIntel)}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
      >
        <span className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Company Intel
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${showIntel ? "rotate-180" : ""}`}
        />
      </button>
      {showIntel && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          <p>Company intel will be populated by agent research runs.</p>
        </div>
      )}

      {/* Quick-add modal */}
      {showAddModal && (
        <QuickAddModal
          companyId={companyId}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

Navigate to `http://localhost:3000/companies/[some-id]`. Expected: page renders with header, empty sections, and Add button.

- [ ] **Step 3: Commit**

```bash
git add web/app/\(app\)/companies/\[id\]/page.tsx
git commit -m "feat: add company detail page with all sections"
```

---

## Task 14: People Names Resolution

The company detail page shows "Unknown" for person names. Add a bulk query for people by IDs.

**Files:**
- Modify: `convex/people.ts`
- Modify: `web/app/(app)/companies/[id]/page.tsx`

- [ ] **Step 1: Add getByIds query to convex/people.ts**

Add this query to `convex/people.ts`:

```typescript
export const getByIds = query({
  args: { personIds: v.array(v.id("people")) },
  handler: async (ctx, { personIds }) => {
    const results = [];
    for (const id of personIds) {
      const person = await ctx.db.get(id);
      if (person) results.push(person);
    }
    return results;
  },
});
```

- [ ] **Step 2: Wire up people names in the company detail page**

In `web/app/(app)/companies/[id]/page.tsx`, add after the `useCompanyDetail` hook call:

```typescript
  const personIds = connections?.map((c: any) => c.personId) ?? [];
  const people = useQuery(
    api.people.getByIds,
    personIds.length > 0 ? { personIds } : "skip"
  );
```

Then replace the `peopleMap` building logic:

```typescript
  const peopleMap = new Map<string, string>();
  if (people) {
    for (const p of people) {
      peopleMap.set(p._id, p.name ?? "Unknown");
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add convex/people.ts web/app/\(app\)/companies/\[id\]/page.tsx
git commit -m "feat: resolve people names in company detail page"
```

---

## Task 15: CLI Check-in Mode

**Files:**
- Create: `modes/checkin.md`

- [ ] **Step 1: Create the check-in mode**

Create `modes/checkin.md`:

```markdown
# Mode: checkin — Daily Connection Check-in

Two flows. Ask which one:

## Flow 1: Log New Requests

User lists connections they sent today. Parse natural language:
- "sent today: John CTO Acme, Sarah recruiter Bolt, Mike eng Stripe"
- "25 requests: [list]"

For each entry:
1. Parse name, role/title, company
2. Find or create the company in Convex (match by name/domain)
3. Find or create the person in Convex
4. Create a `connectionRequests` record with:
   - `status: "pending"`
   - `sentDate: today`
   - `noteWithRequest`: ask once ("did you send notes with these?") or per-entry if mixed
   - Auto-link to existing `agentItems` job_lead if same company exists

Confirm: "Created X connections across Y companies. Z linked to existing leads."

## Flow 2: Status Update

Pull all `pending` connections older than 3 days. Present numbered list:
```
1. Jane D. @ Stripe (Recruiter, sent 04/08) — 5d
2. Bob K. @ Stripe (Eng Mgr, sent 04/08) — 5d
3. Alice R. @ Google (HM, sent 04/09) — 4d
```

User responds with shorthand:
- "1 accepted, 3 accepted, rest pending"
- "1,2 accepted, 3 ignored"
- "all pending" (skip)

For each accepted:
- Update status to `accepted`
- Draft a follow-up message using `contacto` mode framework (3-phrase, max 300 chars)
- Ask: "Want me to draft messages for the accepted connections?"

## Rules

- Keep it fast. The whole check-in should take under 2 minutes.
- Group output by company when showing results.
- After updating, show summary: "Updated: X accepted, Y ignored, Z still pending."
- If any accepted connections are at companies with open leads, highlight: "Jane at Stripe accepted — you have an active lead there (Sr. AI Engineer)."
```

- [ ] **Step 2: Commit**

```bash
git add modes/checkin.md
git commit -m "feat: add daily check-in mode for connection status updates"
```

---

## Task 16: Final Integration Verification

- [ ] **Step 1: Run Convex schema sync**

```bash
cd /Users/apoorva1509/conductor/workspaces/career-ops-v1/montevideo && npx convex dev --once
```

Expected: All tables and functions synced without errors.

- [ ] **Step 2: Run TypeScript type check on the web app**

```bash
cd /Users/apoorva1509/conductor/workspaces/career-ops-v1/montevideo/web && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Verify dev server starts**

```bash
cd /Users/apoorva1509/conductor/workspaces/career-ops-v1/montevideo/web && npm run dev
```

Navigate to:
- `http://localhost:3000/companies` — should show Companies page with filter tabs
- Click any company → `http://localhost:3000/companies/[id]` — should show detail page with all sections

- [ ] **Step 4: Commit any fixes**

If any errors found in steps 1-3, fix them and commit:

```bash
git add -A
git commit -m "fix: resolve type and build errors from company hub integration"
```
