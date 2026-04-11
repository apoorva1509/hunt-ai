import type { OutreachStep, FollowUpReminder } from "./types";

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
