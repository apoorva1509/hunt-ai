"use client";

import { Clock, AlertTriangle } from "lucide-react";
import type { FollowUpReminder } from "./types";
import { daysOverdue } from "./utils";

interface FollowUpBadgeProps {
  reminder: FollowUpReminder;
}

export function FollowUpBadge({ reminder }: FollowUpBadgeProps) {
  const days = daysOverdue(reminder);

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
      {days > 3 ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {days === 0 ? "Follow-up due today" : `${days}d overdue`}
    </span>
  );
}
