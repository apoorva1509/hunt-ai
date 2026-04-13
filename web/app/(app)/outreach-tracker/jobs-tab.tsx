"use client";

import { useState } from "react";
import { useOutreachJobs } from "@/hooks/use-outreach-tracker";
import { JobCard } from "./job-card";
import { MarkAppliedDialog } from "./mark-applied-dialog";
import { ResearchSkeleton } from "./research-skeleton";
import { Briefcase } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

interface JobsTabProps {
  companyId: Id<"outreachCompanies">;
  companyName: string;
  researchStatus?: string;
}

export function JobsTab({ companyId, companyName, researchStatus }: JobsTabProps) {
  const jobs = useOutreachJobs(companyId);
  const [markAppliedJobId, setMarkAppliedJobId] = useState<Id<"outreachJobs"> | null>(null);
  const [markAppliedJobTitle, setMarkAppliedJobTitle] = useState("");

  if (researchStatus === "researching") {
    return <ResearchSkeleton />;
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
        <Briefcase className="mx-auto h-8 w-8 text-zinc-300" />
        <p className="mt-2 text-sm text-zinc-500">No open positions found</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {jobs.map((job: any) => (
          <JobCard
            key={job._id}
            job={job}
            onMarkApplied={(id: any) => {
              setMarkAppliedJobId(id);
              setMarkAppliedJobTitle(job.title);
            }}
          />
        ))}
      </div>

      <MarkAppliedDialog
        open={!!markAppliedJobId}
        onClose={() => setMarkAppliedJobId(null)}
        jobId={markAppliedJobId}
        jobTitle={markAppliedJobTitle}
        companyName={companyName}
      />
    </>
  );
}
