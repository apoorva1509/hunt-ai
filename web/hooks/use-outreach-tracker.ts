"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import type { Id } from "@/convex/_generated/dataModel";

export function useOutreachCompanies() {
  const { user } = useUser();
  return useQuery(
    api.outreachCompanies.list,
    user ? { userId: user.id } : "skip"
  );
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
