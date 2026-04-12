"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  useOutreachContacts,
  useOutreachSteps,
  useJobCounts,
} from "@/hooks/use-outreach-tracker";
import {
  ChevronDown,
  ChevronRight,
  Building2,
  Plus,
  Check,
  Circle,
  SkipForward,
  Trash2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import type { OutreachCompany } from "./types";
import { stepsProgress } from "./utils";
import { ContactCard } from "./contact-card";
import { AddContactDialog } from "./add-contact-dialog";
import { JobsTab } from "./jobs-tab";
import { PeopleTab } from "./people-tab";

const STATUS_COLORS: Record<string, string> = {
  active:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  paused:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  closed:
    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

const RESEARCH_STATUS_COLORS: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  researching: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  failed: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
};

type ActiveTab = "jobs" | "people" | "pipeline";

export function CompanyCard({ company }: { company: OutreachCompany }) {
  const [expanded, setExpanded] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newStepLabel, setNewStepLabel] = useState("");
  const [addingStep, setAddingStep] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("jobs");

  const contacts = useOutreachContacts(expanded ? company._id : null);
  const steps = useOutreachSteps(expanded ? company._id : null);
  const jobCounts = useJobCounts(expanded ? company._id : null);
  const createStep = useMutation(api.outreachSteps.create);
  const updateStepStatus = useMutation(api.outreachSteps.updateStatus);
  const removeStep = useMutation(api.outreachSteps.remove);
  const updateCompany = useMutation(api.outreachCompanies.update);
  const removeCompany = useMutation(api.outreachCompanies.remove);

  const progress = steps ? stepsProgress(steps) : { done: 0, total: 0 };

  const handleAddStep = async () => {
    if (!newStepLabel.trim()) return;
    await createStep({
      companyId: company._id,
      label: newStepLabel.trim(),
    });
    setNewStepLabel("");
    setAddingStep(false);
  };

  const cycleStepStatus = (current: string) => {
    if (current === "pending") return "done" as const;
    if (current === "done") return "skipped" as const;
    return "pending" as const;
  };

  const contactCount = contacts?.length ?? 0;
  const jobCount = typeof jobCounts === "number" ? jobCounts : 0;

  const tabs: { key: ActiveTab; label: string; count?: number }[] = [
    { key: "jobs", label: "Jobs", count: jobCount },
    { key: "people", label: "People", count: contactCount },
    { key: "pipeline", label: "Pipeline" },
  ];

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-start gap-3 p-5 text-left"
        >
          <span className="mt-0.5 text-zinc-400">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {company.logoUrl ? (
                    <img
                      src={company.logoUrl}
                      alt={company.name}
                      className="h-5 w-5 rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <Building2 className="h-4 w-4 text-zinc-400" />
                  )}
                  <h3 className="text-base font-semibold">{company.name}</h3>
                  {company.isYcBacked && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-600 dark:bg-orange-900/30 dark:text-orange-300">
                      YC
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[company.status]}`}
                  >
                    {company.status}
                  </span>
                  {company.researchStatus && company.researchStatus !== "pending" && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${RESEARCH_STATUS_COLORS[company.researchStatus]}`}
                    >
                      {company.researchStatus === "researching" && (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      )}
                      {company.researchStatus}
                    </span>
                  )}
                </div>
                {company.roleAppliedFor && (
                  <p className="mt-1 text-sm text-zinc-500">
                    Targeting: {company.roleAppliedFor}
                  </p>
                )}
                {company.researchSummary && company.researchStatus === "done" && (
                  <p className="mt-1 text-xs text-zinc-400 line-clamp-1">
                    {company.researchSummary}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                {progress.total > 0 && (
                  <p className="text-sm font-medium text-zinc-500">
                    {progress.done}/{progress.total} steps
                  </p>
                )}
              </div>
            </div>
          </div>
        </button>

        {/* Expanded */}
        {expanded && (
          <div className="border-t border-zinc-100 px-5 pb-5 pt-4 dark:border-zinc-800/50 space-y-4">
            {/* Status toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Status:</span>
              {(["active", "paused", "closed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    updateCompany({ id: company._id, status: s })
                  }
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    company.status === s
                      ? STATUS_COLORS[s]
                      : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-500"
                  }`}
                >
                  {s}
                </button>
              ))}
              {company.websiteUrl && (
                <a
                  href={
                    company.websiteUrl.startsWith("http")
                      ? company.websiteUrl
                      : `https://${company.websiteUrl}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-zinc-400 hover:text-zinc-600"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {/* Tab bar */}
            <div className="relative border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative pb-2 px-3 text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? "text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {tab.label}
                      {tab.count !== undefined && tab.count > 0 && (
                        <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                          {tab.count}
                        </span>
                      )}
                    </span>
                    {activeTab === tab.key && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            {activeTab === "jobs" && (
              <JobsTab
                companyId={company._id}
                companyName={company.name}
                researchStatus={company.researchStatus}
              />
            )}

            {activeTab === "people" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Contacts</span>
                  <button
                    onClick={() => setShowAddContact(true)}
                    className="flex items-center gap-1 rounded-md bg-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
                  >
                    <Plus className="h-3 w-3" />
                    Add Contact
                  </button>
                </div>
                <PeopleTab
                  companyId={company._id}
                  researchStatus={company.researchStatus}
                />
              </div>
            )}

            {activeTab === "pipeline" && (
              <div className="space-y-4">
                {/* Steps */}
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Pipeline Steps
                  </h4>
                  <div className="space-y-1.5">
                    {steps?.map((step: any) => (
                      <div
                        key={step._id}
                        className="flex items-center gap-2 group"
                      >
                        <button
                          onClick={() =>
                            updateStepStatus({
                              id: step._id,
                              status: cycleStepStatus(step.status),
                            })
                          }
                          className="shrink-0"
                        >
                          {step.status === "done" ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : step.status === "skipped" ? (
                            <SkipForward className="h-4 w-4 text-zinc-400" />
                          ) : (
                            <Circle className="h-4 w-4 text-zinc-300" />
                          )}
                        </button>
                        <span
                          className={`text-sm flex-1 ${
                            step.status === "done"
                              ? "text-zinc-400 line-through"
                              : step.status === "skipped"
                                ? "text-zinc-400"
                                : "text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {step.label}
                        </span>
                        {step.isAutoGenerated && (
                          <span className="text-[10px] text-zinc-400">auto</span>
                        )}
                        <button
                          onClick={() => removeStep({ id: step._id })}
                          className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {addingStep ? (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={newStepLabel}
                        onChange={(e) => setNewStepLabel(e.target.value)}
                        placeholder="Step name..."
                        className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddStep();
                          if (e.key === "Escape") setAddingStep(false);
                        }}
                      />
                      <button
                        onClick={handleAddStep}
                        className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingStep(true)}
                      className="mt-2 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
                    >
                      <Plus className="h-3 w-3" />
                      Add step
                    </button>
                  )}
                </div>

                {/* Contacts summary in pipeline tab */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Contacts
                    </h4>
                    <button
                      onClick={() => setShowAddContact(true)}
                      className="flex items-center gap-1 rounded-md bg-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
                    >
                      <Plus className="h-3 w-3" />
                      Add Contact
                    </button>
                  </div>
                  {contacts && contacts.length > 0 ? (
                    <div className="space-y-2">
                      {contacts.map((contact: any) => (
                        <ContactCard
                          key={contact._id}
                          contact={contact}
                          companyId={company._id}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400">
                      No contacts yet. Add one by pasting a LinkedIn URL.
                    </p>
                  )}
                </div>

                {/* Delete */}
                <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800/50">
                  <button
                    onClick={() => removeCompany({ id: company._id })}
                    className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete company
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <AddContactDialog
        open={showAddContact}
        onClose={() => setShowAddContact(false)}
        companyId={company._id}
      />
    </>
  );
}
