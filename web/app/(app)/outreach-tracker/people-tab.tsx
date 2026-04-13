"use client";

import { useOutreachContacts } from "@/hooks/use-outreach-tracker";
import { ContactCard } from "./contact-card";
import { ResearchSkeleton } from "./research-skeleton";
import { Users } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

interface PeopleTabProps {
  companyId: Id<"outreachCompanies">;
  researchStatus?: string;
}

export function PeopleTab({ companyId, researchStatus }: PeopleTabProps) {
  const contacts = useOutreachContacts(companyId);

  if (researchStatus === "researching") {
    return <ResearchSkeleton />;
  }

  if (!contacts || contacts.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
        <Users className="mx-auto h-8 w-8 text-zinc-300" />
        <p className="mt-2 text-sm text-zinc-500">No contacts found</p>
      </div>
    );
  }

  const tierOrder = { tier1: 0, tier2: 1, tier3: 2 };
  const sorted = [...contacts].sort((a: any, b: any) => {
    const aOrder = tierOrder[a.tier as keyof typeof tierOrder] ?? 3;
    const bOrder = tierOrder[b.tier as keyof typeof tierOrder] ?? 3;
    return aOrder - bOrder;
  });

  return (
    <div className="space-y-2">
      {sorted.map((contact: any) => (
        <ContactCard key={contact._id} contact={contact} companyId={companyId} />
      ))}
    </div>
  );
}
