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

export function stepsProgress(steps: OutreachStep[]): {
  done: number;
  total: number;
} {
  const done = steps.filter((s) => s.status === "done").length;
  return { done, total: steps.length };
}

export function daysSince(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isOverdue(reminder: FollowUpReminder): boolean {
  return (
    (reminder.status === "pending" || reminder.status === "notified") &&
    reminder.dueAt <= Date.now()
  );
}

export function daysOverdue(reminder: FollowUpReminder): number {
  return Math.max(
    0,
    Math.floor((Date.now() - reminder.dueAt) / (1000 * 60 * 60 * 24))
  );
}

export function deriveContactStage(
  messages: OutreachMessage[],
  connectionStatus?: "pending" | "accepted"
): ContactStage {
  const hasInbound = messages.some((m) => m.direction === "inbound");
  if (hasInbound) return "replied";

  const hasDm = messages.some(
    (m) => m.channel === "linkedin_dm" && m.direction === "outbound"
  );
  if (hasDm) return "dm_sent";

  const hasEmail = messages.some(
    (m) => m.channel === "email" && m.direction === "outbound"
  );
  if (hasEmail) return "dm_sent";

  if (connectionStatus === "accepted") return "accepted";

  return "request_sent";
}

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

export function computeOutreachFunnel(
  contactStages: ContactStage[]
): OutreachFunnel {
  const total = contactStages.length;
  const reached = total;
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
