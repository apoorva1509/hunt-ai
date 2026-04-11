"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useFollowUpReminders } from "./use-outreach-tracker";

export function useFollowUpNotifications() {
  const reminders = useFollowUpReminders();
  const markNotified = useMutation(api.followUpReminders.markNotified);
  const notifiedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!reminders || reminders.length === 0) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    if (Notification.permission !== "granted") return;

    for (const reminder of reminders) {
      if (reminder.status !== "pending") continue;
      if (notifiedIds.current.has(reminder._id)) continue;

      notifiedIds.current.add(reminder._id);

      const notification = new Notification("Follow-up due", {
        body: `Time to follow up (${reminder.channel === "email" ? "Email" : "LinkedIn"})`,
        tag: reminder._id,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      markNotified({ id: reminder._id });
    }
  }, [reminders, markNotified]);

  return {
    overdueCount:
      reminders?.filter(
        (r) => r.status === "pending" || r.status === "notified"
      ).length ?? 0,
  };
}
