"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function useOutreachCompanies() {
  return useQuery(api.outreachCompanies.list, {});
}

export function useOutreachContacts(companyId: Id<"outreachCompanies"> | null) {
  return useQuery(
    api.outreachContacts.listByCompany,
    companyId ? { companyId } : "skip"
  );
}

export function useOutreachSteps(companyId: Id<"outreachCompanies"> | null) {
  return useQuery(
    api.outreachSteps.listByCompany,
    companyId ? { companyId } : "skip"
  );
}

export function useOutreachMessages(
  contactId: Id<"outreachContacts"> | null
) {
  return useQuery(
    api.outreachMessages.listByContact,
    contactId ? { contactId } : "skip"
  );
}

export function useOutreachGuidance(
  contactId: Id<"outreachContacts"> | null
) {
  return useQuery(
    api.outreachGuidance.listByContact,
    contactId ? { contactId } : "skip"
  );
}

export function useFollowUpReminders() {
  return useQuery(api.followUpReminders.listPending, {});
}

export function useFollowUpRemindersByContact(
  contactId: Id<"outreachContacts"> | null
) {
  return useQuery(
    api.followUpReminders.listByContact,
    contactId ? { contactId } : "skip"
  );
}

export function useOverdueCount() {
  return useQuery(api.followUpReminders.countOverdue, {});
}

export function useOutreachJobs(companyId: Id<"outreachCompanies"> | null) {
  return useQuery(
    api.outreachJobs.listByCompany,
    companyId ? { companyId } : "skip"
  );
}

export function useJobCounts(companyId: Id<"outreachCompanies"> | null) {
  return useQuery(
    api.outreachJobs.countByCompany,
    companyId ? { companyId } : "skip"
  );
}

export function useOutreachMessagesByCompany(
  companyId: Id<"outreachCompanies"> | null
) {
  return useQuery(
    api.outreachMessages.listByCompany,
    companyId ? { companyId } : "skip"
  );
}
