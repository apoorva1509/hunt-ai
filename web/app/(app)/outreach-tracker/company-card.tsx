"use client";

import { useState, useMemo, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  useOutreachContacts,
  useOutreachSteps,
  useJobCounts,
  useOutreachMessagesByCompany,
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
  FileText,
  Upload,
  Download,
  Eye,
  X,
} from "lucide-react";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
import type { OutreachCompany, OutreachMessage } from "./types";
import { COMPANY_BORDER_COLORS } from "./types";
import { stepsProgress, deriveContactStage, computeOutreachFunnel, deriveCompanyOutreachStatus } from "./utils";
import { OutreachFunnelBar } from "./outreach-funnel";
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
  const [uploading, setUploading] = useState(false);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const contacts = useOutreachContacts(company._id);
  const steps = useOutreachSteps(expanded ? company._id : null);
  const jobCounts = useJobCounts(expanded ? company._id : null);
  const companyMessages = useOutreachMessagesByCompany(company._id);
  const resumeUrl = useQuery(api.outreachCompanies.getResumeUrl, { id: company._id });

  const { funnel, outreachStatus } = useMemo(() => {
    if (!contacts || !companyMessages) {
      return {
        funnel: { reached: 0, connected: 0, dmed: 0, replied: 0, total: 0 },
        outreachStatus: "needs_outreach" as const,
      };
    }

    const messagesByContact = new Map<string, OutreachMessage[]>();
    for (const msg of companyMessages) {
      const existing = messagesByContact.get(msg.contactId) ?? [];
      existing.push(msg as OutreachMessage);
      messagesByContact.set(msg.contactId, existing);
    }

    const stages = contacts.map((contact: any) => {
      const contactMessages = messagesByContact.get(contact._id) ?? [];
      return deriveContactStage(contactMessages, contact.connectionStatus);
    });

    const funnel = computeOutreachFunnel(stages);
    const latestMessage = companyMessages.length > 0
      ? Math.max(...companyMessages.map((m: any) => m.sentAt))
      : null;
    const outreachStatus = deriveCompanyOutreachStatus(funnel, latestMessage);

    return { funnel, outreachStatus };
  }, [contacts, companyMessages]);

  const createStep = useMutation(api.outreachSteps.create);
  const updateStepStatus = useMutation(api.outreachSteps.updateStatus);
  const removeStep = useMutation(api.outreachSteps.remove);
  const updateCompany = useMutation(api.outreachCompanies.update);
  const removeCompany = useMutation(api.outreachCompanies.remove);
  const generateUploadUrl = useMutation(api.outreachCompanies.generateResumeUploadUrl);
  const linkResume = useMutation(api.outreachCompanies.linkResume);
  const removeResume = useMutation(api.outreachCompanies.removeResume);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await res.json();
      await linkResume({ id: company._id, storageId, fileName: file.name });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
      <div className={`rounded-xl border border-zinc-200 border-l-4 bg-white shadow-sm transition-all hover:shadow-lg hover:shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:shadow-zinc-100/5 ${COMPANY_BORDER_COLORS[outreachStatus]}`}>
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
                  <h3 className="text-base font-bold tracking-tight">{company.name}</h3>
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
              <div className="flex items-center gap-2 shrink-0">
                {progress.total > 0 && (
                  <p className="text-sm font-medium text-zinc-500">
                    {progress.done}/{progress.total} steps
                  </p>
                )}
                {company.linkedinUrl && (
                  <a
                    href={company.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-zinc-400 hover:text-[#0A66C2] transition-colors"
                  >
                    <LinkedInIcon className="h-3.5 w-3.5" />
                  </a>
                )}
                {company.websiteUrl && (
                  <a
                    href={company.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-zinc-400 hover:text-zinc-600"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {company.resumeStorageId ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowResumePreview(true);
                    }}
                    className="text-green-500 hover:text-green-700 transition-colors"
                    title={company.resumeFileName ?? "Resume"}
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="text-zinc-300 hover:text-zinc-500 transition-colors"
                    title="Upload tailored resume"
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete ${company.name} and all its jobs, contacts, and messages?`)) {
                      removeCompany({ id: company._id });
                    }
                  }}
                  className="text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </button>

        {/* Outreach Funnel — always visible */}
        {funnel.total > 0 && (
          <div className="border-t border-zinc-100 px-5 py-2.5 dark:border-zinc-800/50">
            <OutreachFunnelBar funnel={funnel} outreachStatus={outreachStatus} />
          </div>
        )}

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
              <div className="ml-auto flex items-center gap-2">
                {company.resumeStorageId ? (
                  <>
                    <button
                      onClick={() => setShowResumePreview(true)}
                      className="flex items-center gap-1 rounded-md bg-green-100 px-2 py-1 text-[11px] font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300"
                    >
                      <Eye className="h-3 w-3" />
                      Resume
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    <Upload className="h-3 w-3" />
                    {uploading ? "Uploading..." : "Upload Resume"}
                  </button>
                )}
                {company.websiteUrl && (
                  <a
                    href={
                      company.websiteUrl.startsWith("http")
                        ? company.websiteUrl
                        : `https://${company.websiteUrl}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-zinc-600"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
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

      {/* Hidden file input for resume upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleResumeUpload}
      />

      {/* Resume preview modal */}
      {showResumePreview && resumeUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl h-[85vh] mx-4 rounded-xl bg-white shadow-2xl dark:bg-zinc-900 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-zinc-500" />
                <span className="text-sm font-medium">
                  {company.resumeFileName ?? "Resume"} — {company.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  <Upload className="h-3 w-3" />
                  Replace
                </button>
                <a
                  href={resumeUrl}
                  download={company.resumeFileName ?? "resume.pdf"}
                  className="flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  <Download className="h-3 w-3" />
                  Download
                </a>
                <button
                  onClick={() => {
                    if (confirm("Remove this resume?")) {
                      removeResume({ id: company._id });
                      setShowResumePreview(false);
                    }
                  }}
                  className="flex items-center gap-1 rounded-md bg-red-100 px-2.5 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setShowResumePreview(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={resumeUrl}
                className="w-full h-full"
                title="Resume preview"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
