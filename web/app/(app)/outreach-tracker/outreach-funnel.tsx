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
