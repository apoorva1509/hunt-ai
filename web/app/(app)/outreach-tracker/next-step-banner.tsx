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
