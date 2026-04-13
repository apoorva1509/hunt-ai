"use client";

import { useState, useCallback } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Search, Send, Check, X, Pencil, Loader2, ExternalLink, Building2,
  User, Sparkles, AlertCircle, MessageSquare, Clock, Shield, UserCheck,
  Ban, AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronRight,
} from "lucide-react";
import { TIER_LABELS, TIER_COLORS } from "./types";
import type { ContactTier } from "./types";

// ── Types ───────────────────────────────────────────────────

type CandidateStatus =
  | "new" | "checking" | "approved" | "skipped" | "editing"
  | "sending" | "sent" | "failed" | "already_connected" | "pending_connection" | "follow_only";

type MessageMode = "connection" | "dm";

interface Candidate {
  name: string;
  title: string;
  headline: string;
  linkedinUrl: string;
  email: string | null;
  photoUrl: string | null;
  priority: number;
  tier: ContactTier;
}

interface CandidateWithMessage {
  name: string;
  title: string;
  headline: string;
  linkedinUrl: string;
  email?: string;
  photoUrl?: string;
  priority: number;
  tier: ContactTier;
  message: string;
  dmMessage: string;
  status: string;
  mode: MessageMode;
}

interface CompanyInfo {
  name: string;
  domain: string | null;
  industry: string | null;
  description: string | null;
  logoUrl: string | null;
  linkedinUrl: string;
}

// Local UI state extends the Convex data with ephemeral fields
interface CandidateUI extends CandidateWithMessage {
  editMessage?: string;
  errorDetail?: string;
  hasNote?: boolean;
}

const CV_SUMMARY = `Apoorva Agarwal — AI Product Engineer / Full Stack Engineer at Salesmonk (early-stage B2B sales automation). BITS Pilani, M.Sc. Mathematics + Data Science. Built visual workflow engine (React Flow + Temporal), AI web-scraping agents, RAG knowledge base, multichannel campaign engine. Tech: Next.js, React, TypeScript, Prisma, NestJS, Temporal, Inngest, PostgreSQL, AI SDK, OpenAI, Anthropic, LlamaIndex, LangGraph.`;

const STATUS_BADGE: Record<string, { label: string; color: string; icon?: any }> = {
  new: { label: "Review", color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  checking: { label: "Checking...", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", icon: Loader2 },
  approved: { label: "Approved", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", icon: Check },
  skipped: { label: "Skipped", color: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
  editing: { label: "Editing", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", icon: Pencil },
  sending: { label: "Sending...", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", icon: Loader2 },
  sent: { label: "Sent", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", icon: Check },
  failed: { label: "Failed", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", icon: AlertCircle },
  already_connected: { label: "Connected", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", icon: UserCheck },
  pending_connection: { label: "Pending", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", icon: Clock },
  follow_only: { label: "Follow Only", color: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800", icon: Ban },
};

// ── Main Component ──────────────────────────────────────────

export function ConnectTab() {
  const [companyUrl, setCompanyUrl] = useState("");
  const [role, setRole] = useState("");
  const [searchStep, setSearchStep] = useState<"idle" | "searching" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sendingSession, setSendingSession] = useState<string | null>(null);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, currentName: "" });

  // Ephemeral UI state per candidate (edit messages, error details)
  const [uiState, setUiState] = useState<Record<string, Partial<CandidateUI>>>({});

  // ── Convex hooks ──────────────────────────────────────────

  const sessions = useQuery(api.connectResearch.list) ?? [];
  const saveResearch = useMutation(api.connectResearch.save);
  const updateCandidateMut = useMutation(api.connectResearch.updateCandidate);
  const removeCandidatesMut = useMutation(api.connectResearch.removeCandidates);
  const removeSession = useMutation(api.connectResearch.remove);
  const generateMessages = useAction(api.outreachConnect.generateMessages);
  const generateDmMessages = useAction(api.outreachConnect.generateDmMessages);
  const saveAndSend = useAction(api.outreachConnect.saveAndSend);

  // ── UI state helpers ──────────────────────────────────────

  const getUi = (linkedinUrl: string): Partial<CandidateUI> => uiState[linkedinUrl] || {};
  const setUi = (linkedinUrl: string, updates: Partial<CandidateUI>) => {
    setUiState((prev) => ({ ...prev, [linkedinUrl]: { ...prev[linkedinUrl], ...updates } }));
  };

  // ── Search & Generate ─────────────────────────────────────

  const handleSearch = async () => {
    if (!companyUrl.trim() || !role.trim()) return;
    setError(null);
    setSearchStep("searching");

    try {
      const searchRes = await fetch("/api/outreach-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyLinkedinUrl: companyUrl.trim(), role: role.trim() }),
      });
      if (!searchRes.ok) {
        const errData = await searchRes.json().catch(() => ({}));
        throw new Error(errData.error || `Search failed (${searchRes.status})`);
      }
      const result = await searchRes.json();

      if (result.candidates.length === 0) {
        setError("No candidates found. Check the LinkedIn URL or try a different company.");
        setSearchStep("idle");
        return;
      }

      setSearchStep("generating");

      // Generate both connection + DM messages in parallel
      const [messages, dmMessages] = await Promise.all([
        generateMessages({
          candidates: result.candidates.map((c: Candidate) => ({
            name: c.name, title: c.title, headline: c.headline, linkedinUrl: c.linkedinUrl,
          })),
          companyName: result.company.name,
          companyDescription: result.company.description ?? undefined,
          companyIndustry: result.company.industry ?? undefined,
          role: role.trim(),
          cvSummary: CV_SUMMARY,
        }),
        generateDmMessages({
          candidates: result.candidates.map((c: Candidate) => ({
            name: c.name, title: c.title, headline: c.headline, linkedinUrl: c.linkedinUrl,
          })),
          companyName: result.company.name,
          companyDescription: result.company.description ?? undefined,
          role: role.trim(),
          cvSummary: CV_SUMMARY,
        }),
      ]);

      const msgMap = new Map(messages.map((m: any) => [m.linkedinUrl, m.message]));
      const dmMap = new Map(dmMessages.map((m: any) => [m.linkedinUrl, m.message]));

      const candidatesWithMessages = result.candidates.map((c: Candidate) => ({
        name: c.name,
        title: c.title,
        headline: c.headline,
        linkedinUrl: c.linkedinUrl,
        email: c.email ?? undefined,
        photoUrl: c.photoUrl ?? undefined,
        priority: c.priority,
        tier: c.tier,
        message: msgMap.get(c.linkedinUrl) || "",
        dmMessage: dmMap.get(c.linkedinUrl) || "",
        status: "new",
        mode: "connection" as const,
      }));

      // Save to Convex
      const sessionId = await saveResearch({
        companyLinkedinUrl: companyUrl.trim(),
        companyName: result.company.name,
        companyDomain: result.company.domain ?? undefined,
        companyIndustry: result.company.industry ?? undefined,
        companyDescription: result.company.description ?? undefined,
        companyLogoUrl: result.company.logoUrl ?? undefined,
        role: role.trim(),
        candidates: candidatesWithMessages,
      });

      setExpandedSession(sessionId);
      setCompanyUrl("");
      setRole("");
      setSearchStep("idle");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setSearchStep("idle");
    }
  };

  // ── Candidate Actions (update in Convex) ──────────────────

  const handleUpdateStatus = async (sessionId: Id<"connectResearch">, linkedinUrl: string, status: string, mode?: MessageMode) => {
    await updateCandidateMut({
      sessionId,
      linkedinUrl,
      updates: { status, ...(mode ? { mode } : {}) },
    });
  };

  const handleSaveEdit = async (sessionId: Id<"connectResearch">, linkedinUrl: string, mode: MessageMode, editedMessage: string) => {
    const updates: any = { status: "approved" };
    if (mode === "dm") updates.dmMessage = editedMessage;
    else updates.message = editedMessage;
    await updateCandidateMut({ sessionId, linkedinUrl, updates });
    setUi(linkedinUrl, { editMessage: undefined });
  };

  // ── Check Connection Status via Playwright ────────────────

  const handleCheckStatus = async (sessionId: Id<"connectResearch">, linkedinUrl: string) => {
    setUi(linkedinUrl, { status: "checking" });
    try {
      const res = await fetch("/api/outreach-connect/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check", profileUrl: linkedinUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUi(linkedinUrl, { status: undefined, errorDetail: data.error });
        return;
      }
      const statusMap: Record<string, { status: string; mode?: MessageMode }> = {
        already_connected: { status: "already_connected", mode: "dm" },
        pending: { status: "pending_connection" },
        follow_only: { status: "follow_only" },
        not_connected: { status: "new" },
      };
      const mapped = statusMap[data.status] || { status: "new" };
      await handleUpdateStatus(sessionId, linkedinUrl, mapped.status, mapped.mode);
      setUi(linkedinUrl, { status: undefined, errorDetail: undefined });
    } catch {
      setUi(linkedinUrl, { status: undefined, errorDetail: "Network error" });
    }
  };

  // ── Send One Candidate via Playwright ─────────────────────

  const handleSendOne = async (sessionId: Id<"connectResearch">, candidate: CandidateWithMessage): Promise<boolean> => {
    setUi(candidate.linkedinUrl, { status: "sending" });
    const action = candidate.mode === "dm" ? "send_dm" : "send_connection";
    const message = candidate.mode === "dm" ? candidate.dmMessage : candidate.message;

    try {
      const res = await fetch("/api/outreach-connect/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, profileUrl: candidate.linkedinUrl, message }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === "ALREADY_CONNECTED") {
          await handleUpdateStatus(sessionId, candidate.linkedinUrl, "already_connected", "dm");
        } else if (data.code === "PENDING") {
          await handleUpdateStatus(sessionId, candidate.linkedinUrl, "pending_connection");
        } else {
          setUi(candidate.linkedinUrl, { status: "failed", errorDetail: data.error });
          await handleUpdateStatus(sessionId, candidate.linkedinUrl, "failed");
        }
        return false;
      }

      setUi(candidate.linkedinUrl, { status: "sent", hasNote: data.hasNote });
      return true;
    } catch (err: any) {
      setUi(candidate.linkedinUrl, { status: "failed", errorDetail: err.message });
      await handleUpdateStatus(sessionId, candidate.linkedinUrl, "failed");
      return false;
    }
  };

  // ── Send All Approved in a Session ────────────────────────

  const handleSendAllApproved = async (session: any) => {
    const approved = session.candidates.filter((c: CandidateWithMessage) => c.status === "approved");
    if (approved.length === 0) return;

    setSendingSession(session._id);
    setSendProgress({ current: 0, total: approved.length, currentName: "" });

    const sentUrls: string[] = [];

    for (let i = 0; i < approved.length; i++) {
      const candidate = approved[i];
      setSendProgress({ current: i + 1, total: approved.length, currentName: candidate.name });

      const success = await handleSendOne(session._id, candidate);
      if (success) sentUrls.push(candidate.linkedinUrl);

      // Random delay between sends (30-90s)
      if (i < approved.length - 1) {
        const delay = randomBetween(30000, 90000);
        setSendProgress((prev) => ({ ...prev, currentName: `Waiting ${Math.round(delay / 1000)}s...` }));
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    // Save sent candidates to tracker and remove from research
    if (sentUrls.length > 0) {
      const sentCandidates = approved.filter((c: CandidateWithMessage) => sentUrls.includes(c.linkedinUrl));
      try {
        await saveAndSend({
          companyName: session.companyName,
          companyDomain: session.companyDomain,
          companyLinkedinUrl: session.companyLinkedinUrl,
          companyDescription: session.companyDescription,
          companyIndustry: session.companyIndustry,
          companyLogoUrl: session.companyLogoUrl,
          role: session.role,
          approved: sentCandidates.map((c: CandidateWithMessage) => ({
            name: c.name, title: c.title, headline: c.headline, linkedinUrl: c.linkedinUrl,
            email: c.email, photoUrl: c.photoUrl, tier: c.tier,
            message: c.mode === "dm" ? c.dmMessage : c.message,
            messageType: c.mode,
          })),
        });

        // Remove sent candidates from research
        await removeCandidatesMut({ sessionId: session._id, linkedinUrls: sentUrls });
      } catch (err: any) {
        setError(`Tracker save failed: ${err.message}`);
      }
    }

    setSendingSession(null);
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Search Form */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-5 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <h2 className="text-lg font-semibold">Find & Connect</h2>
        </div>
        <p className="mb-5 text-sm text-zinc-500">
          Enter a company LinkedIn page and the role you're targeting. Research is saved automatically — no credits wasted on refresh.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Company LinkedIn URL *</label>
            <input
              type="url" value={companyUrl} onChange={(e) => setCompanyUrl(e.target.value)}
              placeholder="https://linkedin.com/company/stripe" disabled={searchStep !== "idle"}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm placeholder:text-zinc-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Target Role *</label>
            <input
              type="text" value={role} onChange={(e) => setRole(e.target.value)}
              placeholder="Senior AI Engineer" disabled={searchStep !== "idle"}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm placeholder:text-zinc-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>

        <button
          onClick={handleSearch} disabled={!companyUrl.trim() || !role.trim() || searchStep !== "idle"}
          className="mt-4 flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {searchStep === "searching" ? <><Loader2 className="h-4 w-4 animate-spin" /> Finding people...</>
           : searchStep === "generating" ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating messages...</>
           : <><Search className="h-4 w-4" /> Find People</>}
        </button>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* Sending Progress */}
      {sendingSession && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950/50">
          <div className="mb-2 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
            <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
              Sending {sendProgress.current}/{sendProgress.total} — {sendProgress.currentName}
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-purple-200 dark:bg-purple-900">
            <div className="h-full rounded-full bg-purple-600 transition-all duration-500"
              style={{ width: `${sendProgress.total > 0 ? (sendProgress.current / sendProgress.total) * 100 : 0}%` }} />
          </div>
          <p className="mt-2 text-xs text-purple-600 dark:text-purple-400">Random 30-90s delays between sends to keep your account safe</p>
        </div>
      )}

      {/* Research Sessions */}
      {sessions.length === 0 && searchStep === "idle" && (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <Search className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-3 text-sm text-zinc-500">No research yet. Search a company above to get started.</p>
        </div>
      )}

      {sessions.map((session: any) => (
        <SessionCard
          key={session._id}
          session={session}
          expanded={expandedSession === session._id}
          onToggle={() => setExpandedSession(expandedSession === session._id ? null : session._id)}
          isSending={sendingSession === session._id}
          uiState={uiState}
          onUpdateStatus={(url, status, mode) => handleUpdateStatus(session._id, url, status, mode)}
          onCheckStatus={(url) => handleCheckStatus(session._id, url)}
          onSendOne={(c) => handleSendOne(session._id, c)}
          onSendAll={() => handleSendAllApproved(session)}
          onSaveEdit={(url, mode, msg) => handleSaveEdit(session._id, url, mode, msg)}
          onSetUi={(url, updates) => setUi(url, updates)}
          onDelete={() => removeSession({ id: session._id })}
        />
      ))}
    </div>
  );
}

// ── Session Card ────────────────────────────────────────────

function SessionCard({ session, expanded, onToggle, isSending, uiState, onUpdateStatus, onCheckStatus, onSendOne, onSendAll, onSaveEdit, onSetUi, onDelete }: {
  session: any;
  expanded: boolean;
  onToggle: () => void;
  isSending: boolean;
  uiState: Record<string, Partial<CandidateUI>>;
  onUpdateStatus: (url: string, status: string, mode?: MessageMode) => void;
  onCheckStatus: (url: string) => void;
  onSendOne: (c: CandidateWithMessage) => void;
  onSendAll: () => void;
  onSaveEdit: (url: string, mode: MessageMode, msg: string) => void;
  onSetUi: (url: string, updates: Partial<CandidateUI>) => void;
  onDelete: () => void;
}) {
  const candidates: CandidateWithMessage[] = session.candidates || [];
  const approvedCount = candidates.filter((c) => c.status === "approved").length;
  const newCount = candidates.filter((c) => c.status === "new").length;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Header */}
      <button onClick={onToggle} className="flex w-full items-center gap-4 p-4 text-left">
        {session.companyLogoUrl ? (
          <img src={session.companyLogoUrl} alt="" className="h-10 w-10 rounded-lg object-contain" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <Building2 className="h-5 w-5 text-zinc-400" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{session.companyName}</h3>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">{session.role}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>{candidates.length} candidates</span>
            {approvedCount > 0 && <span className="text-green-600">{approvedCount} approved</span>}
            {session.companyIndustry && <span>{session.companyIndustry}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          {/* Actions Bar */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  const toCheck = candidates.filter((c) => c.status === "new");
                  (async () => {
                    for (const c of toCheck) {
                      await onCheckStatus(c.linkedinUrl);
                      await new Promise((r) => setTimeout(r, randomBetween(2000, 4000)));
                    }
                  })();
                }}
                disabled={newCount === 0 || isSending}
                className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-400"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Auto-detect ({newCount})
              </button>
              <button
                onClick={() => candidates.filter((c) => c.status === "new" || c.status === "already_connected").forEach((c) => onUpdateStatus(c.linkedinUrl, "approved"))}
                disabled={newCount === 0 || isSending}
                className="flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:border-green-800 dark:bg-green-950/50 dark:text-green-400"
              >
                <Check className="h-3.5 w-3.5" /> Approve All
              </button>
              <button onClick={onDelete} disabled={isSending}
                className="flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
            <button onClick={onSendAll} disabled={approvedCount === 0 || isSending}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> Send {approvedCount} Message{approvedCount !== 1 ? "s" : ""}
            </button>
          </div>

          {/* Candidate Cards */}
          <div className="space-y-3">
            {candidates.map((candidate: CandidateWithMessage, idx: number) => {
              const ui = uiState[candidate.linkedinUrl] || {};
              const effectiveStatus = ui.status || candidate.status;

              return (
                <CandidateCard
                  key={candidate.linkedinUrl}
                  candidate={{ ...candidate, status: effectiveStatus }}
                  ui={ui}
                  index={idx}
                  total={candidates.length}
                  disabled={isSending}
                  onApprove={() => onUpdateStatus(candidate.linkedinUrl, "approved")}
                  onSkip={() => onUpdateStatus(candidate.linkedinUrl, "skipped")}
                  onEdit={() => onSetUi(candidate.linkedinUrl, { editMessage: candidate.mode === "dm" ? candidate.dmMessage : candidate.message })}
                  onSaveEdit={(msg) => onSaveEdit(candidate.linkedinUrl, candidate.mode, msg)}
                  onCancelEdit={() => onSetUi(candidate.linkedinUrl, { editMessage: undefined })}
                  onEditChange={(msg) => onSetUi(candidate.linkedinUrl, { editMessage: msg })}
                  onToggleConnected={() => {
                    const newMode = candidate.mode === "dm" ? "connection" : "dm";
                    onUpdateStatus(candidate.linkedinUrl, newMode === "dm" ? "already_connected" : "new", newMode);
                  }}
                  onCheckStatus={() => onCheckStatus(candidate.linkedinUrl)}
                  onRetry={() => onSendOne(candidate)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Candidate Card ──────────────────────────────────────────

function CandidateCard({ candidate, ui, index, total, disabled, onApprove, onSkip, onEdit, onSaveEdit, onCancelEdit, onEditChange, onToggleConnected, onCheckStatus, onRetry }: {
  candidate: CandidateWithMessage & { status: string };
  ui: Partial<CandidateUI>;
  index: number;
  total: number;
  disabled: boolean;
  onApprove: () => void;
  onSkip: () => void;
  onEdit: () => void;
  onSaveEdit: (msg: string) => void;
  onCancelEdit: () => void;
  onEditChange: (msg: string) => void;
  onToggleConnected: () => void;
  onCheckStatus: () => void;
  onRetry: () => void;
}) {
  const status = candidate.status;
  const isEditing = ui.editMessage !== undefined;
  const badge = STATUS_BADGE[status] || STATUS_BADGE.new;
  const activeMessage = candidate.mode === "dm" ? candidate.dmMessage : candidate.message;
  const maxChars = candidate.mode === "dm" ? 500 : 300;
  const isActionable = !disabled && !["sent", "sending", "checking", "pending_connection", "follow_only"].includes(status);

  const borderColor: Record<string, string> = {
    new: "border-zinc-200 dark:border-zinc-800",
    approved: "border-green-300 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20",
    skipped: "border-zinc-200 opacity-50 dark:border-zinc-800",
    sending: "border-blue-300 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20",
    sent: "border-green-300 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20",
    failed: "border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20",
    already_connected: "border-blue-300 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/10",
    pending_connection: "border-amber-300 bg-amber-50/30 dark:border-amber-900",
    follow_only: "border-zinc-200 opacity-60 dark:border-zinc-800",
    checking: "border-blue-200 dark:border-blue-800",
  };

  return (
    <div className={`rounded-xl border bg-white p-4 transition-colors dark:bg-zinc-950 ${borderColor[status] || borderColor.new}`}>
      <div className="flex items-start gap-4">
        {candidate.photoUrl ? (
          <img src={candidate.photoUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <User className="h-5 w-5 text-zinc-400" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate font-medium text-zinc-900 dark:text-zinc-100">{candidate.name}</h4>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${TIER_COLORS[candidate.tier]}`}>{TIER_LABELS[candidate.tier]}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.color}`}>
              {badge.icon && <badge.icon className={`h-3 w-3 ${status === "checking" || status === "sending" ? "animate-spin" : ""}`} />}
              {badge.label}
            </span>
            {candidate.mode === "dm" && status !== "follow_only" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <MessageSquare className="h-3 w-3" /> DM
              </span>
            )}
            <span className="text-xs text-zinc-400">#{index + 1}/{total}</span>
          </div>
          <p className="truncate text-sm text-zinc-500">{candidate.title}</p>
          {candidate.headline && <p className="mt-0.5 truncate text-xs text-zinc-400">{candidate.headline}</p>}
          <a href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600">
            <ExternalLink className="h-3 w-3" /> Profile
          </a>
        </div>

        {isActionable && !isEditing && (
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              {status !== "approved" && (
                <button onClick={onApprove} className="rounded-lg border border-green-300 p-2 text-green-600 hover:bg-green-50 dark:border-green-800" title="Approve"><Check className="h-4 w-4" /></button>
              )}
              <button onClick={onEdit} className="rounded-lg border border-zinc-300 p-2 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700" title="Edit"><Pencil className="h-4 w-4" /></button>
              <button onClick={onSkip} className="rounded-lg border border-zinc-300 p-2 text-zinc-400 hover:bg-zinc-50 dark:border-zinc-700" title="Skip"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={onToggleConnected} className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium ${candidate.mode === "dm" ? "border-blue-300 text-blue-600" : "border-zinc-300 text-zinc-500"}`}>
                <UserCheck className="h-3 w-3" /> {candidate.mode === "dm" ? "Connected" : "Mark Connected"}
              </button>
              <button onClick={onCheckStatus} className="flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-[10px] font-medium text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700">
                <RefreshCw className="h-3 w-3" /> Detect
              </button>
            </div>
          </div>
        )}

        {status === "failed" && !disabled && (
          <button onClick={onRetry} className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        )}
      </div>

      {/* Error / Pending / Follow-only messages */}
      {status === "failed" && ui.errorDetail && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 dark:bg-red-950/30"><AlertTriangle className="h-3 w-3" /> {ui.errorDetail}</div>
      )}
      {status === "pending_connection" && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-600 dark:bg-amber-950/30"><Clock className="h-3 w-3" /> Connection request already pending</div>
      )}
      {status === "follow_only" && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs text-zinc-500 dark:bg-zinc-800"><Ban className="h-3 w-3" /> Follow only — Connect not available</div>
      )}

      {/* Message */}
      {!isEditing && status !== "pending_connection" && status !== "follow_only" ? (
        <div className="mt-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">{candidate.mode === "dm" ? "Direct Message" : "Connection Request"}</span>
            <span className={`text-[10px] font-medium ${activeMessage.length > maxChars ? "text-red-500" : "text-zinc-400"}`}>{activeMessage.length}/{maxChars}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{activeMessage || "Edit to write manually"}</p>
          {candidate.mode === "dm" && <p className="mt-2 text-[10px] italic text-zinc-400">Resume attached automatically</p>}
        </div>
      ) : isEditing ? (
        <div className="mt-3">
          <textarea value={ui.editMessage || ""} onChange={(e) => onEditChange(e.target.value)} rows={candidate.mode === "dm" ? 6 : 4}
            className="w-full rounded-lg border border-purple-300 bg-white px-3 py-2.5 text-sm leading-relaxed focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-purple-800 dark:bg-zinc-900" />
          <div className="mt-2 flex items-center justify-between">
            <span className={`text-xs ${(ui.editMessage?.length || 0) > maxChars ? "text-red-500" : "text-zinc-400"}`}>{ui.editMessage?.length || 0}/{maxChars}</span>
            <div className="flex gap-2">
              <button onClick={onCancelEdit} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700">Cancel</button>
              <button onClick={() => onSaveEdit(ui.editMessage || activeMessage)} disabled={(ui.editMessage?.length || 0) > maxChars}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50">Save & Approve</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
