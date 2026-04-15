"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  User,
  Send,
  FileText,
  Play,
  Settings,
  LayoutDashboard,
  LinkIcon,
  Target,
  Building2,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgent } from "@/components/providers/agent-provider";
import { Id } from "@/convex/_generated/dataModel";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/leads", label: "Leads", icon: Briefcase },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/tracker", label: "Tracker", icon: LinkIcon },
  { href: "/outreach", label: "Outreach", icon: Send },
  { href: "/outreach-tracker", label: "Outreach CRM", icon: Target },
  { href: "/meetings", label: "Meetings", icon: Calendar },
  { href: "/resumes", label: "Resumes", icon: FileText },
  { href: "/pipeline", label: "Pipeline", icon: Play },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { agents, activeAgent, setActiveAgentId, isLoading } = useAgent();

  return (
    <aside className="flex w-64 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex h-14 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
        <h1 className="text-lg font-semibold">Career Ops</h1>
      </div>

      {/* Agent selector */}
      <div className="border-b border-zinc-200 px-3 py-3 dark:border-zinc-800">
        <label className="mb-1 block text-xs font-medium text-zinc-500">
          Active Agent
        </label>
        {isLoading ? (
          <div className="h-9 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        ) : agents && agents.length > 0 ? (
          <select
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            value={activeAgent?._id ?? ""}
            onChange={(e) =>
              setActiveAgentId(e.target.value as Id<"agents">)
            }
          >
            {agents.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-zinc-400">No agents yet</p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
