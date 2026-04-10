// ── Agent Config ──────────────────────────────────────────────

export interface CandidateProfile {
  currentCtcFixed?: number;
  currentCtcVariable?: number;
  offersInHand: Array<{
    amountLpa: number;
    currency: "INR" | "USD";
    anonymous: boolean;
  }>;
  targetCtcUsd?: number;
  revealTargetCtc: boolean;
  availableFrom?: string;
  noticePeriodDays?: number;
  positioning?: string;
}

export interface AgentConfig {
  targetRoles: string[];
  preferredPay: number;
  currency: string;
  targetLocations: string[];
  visaSponsorshipRequired: boolean;
  maxApplicationsPerCompany: number;
  resumeText: string;
  resumes?: Record<string, string>;
  candidateProfile: CandidateProfile;
  trigger: { cron: string; timezone: string };
}

export interface OutreachStrategy {
  _id: string;
  agentId: string;
  name: string;
  description: string;
  channel: "linkedin" | "email" | "whatsapp";
  goal: string;
  angle: string;
  templateNotes: string;
  regionHints: string[];
  isActive: boolean;
  sortOrder?: number;
}

// ── Search ───────────────────────────────────────────────────

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
}

export type SearchBackend = "searxng";

// ── Job Discovery ────────────────────────────────────────────

export interface DiscoveredJob {
  company: string;
  role: string;
  url: string;
  jobBoard: "linkedin" | "yc_wats" | "wellfound" | "naukri" | "instahyre" | "cutshort" | "hn_hiring" | "topstartups" | "other";
  salary?: number;
  salarySource?: string;
  snippet?: string;
  visaSponsorship?: boolean;
}

export type ArchetypeId =
  | "ai_platform_llmops"
  | "agentic_automation"
  | "technical_ai_pm"
  | "solutions_architect"
  | "forward_deployed"
  | "ai_transformation";

export type WorkMode = "remote" | "hybrid" | "onsite" | "unknown";

export interface ClassifiedJob extends DiscoveredJob {
  archetype: ArchetypeId;
  archetypeConfidence: "keyword" | "llm" | "default";
  jdText?: string;
  isLive: boolean;
  location?: string;
  workMode: WorkMode;
}

// ── Company Intelligence ─────────────────────────────────────

export interface CompensationData {
  min?: number;
  max?: number;
  currency: string;
  source?: string;
}

export interface CompanyIntel {
  name: string;
  domain: string;
  fundingStage?: "seed" | "series-a" | "series-b" | "series-c+" | "public";
  lastFundingAt?: string;
  investors?: string[];
  recentLaunches: string[];
  aiMaturity: "early" | "scaling" | "core" | "unknown";
  openRoles: DiscoveredJob[];
  painPoints: string[];
  growthSignals: string[];
  competitors: string[];
  marketPosition: string;
  techStack: string[];
  rawSnippets: string[];
  compensationRange?: CompensationData;
}

// ── Decision Makers ──────────────────────────────────────────

export interface DecisionMakerCandidate {
  name: string;
  title: string;
  linkedinUrl: string;
  email?: string;
  source: "linkedin" | "email" | "web";
}

export interface DecisionMaker {
  name: string;
  title: string;
  company: string;
  linkedinUrl?: string;
  email?: string;
  phone?: string;
  pictureUrl?: string;
  headline?: string;
  about?: string;
  recentActivity: string[];
  careerHistory: string[];
  skills: string[];
  mutualConnections?: number;
  publicContent: string[];
  recentFocus: string;
}

// ── Scoring ──────────────────────────────────────────────────

export interface ScoreDimensions {
  northStar: number;
  cvMatch: number;
  seniority: number;
  compensation: number;
  growth: number;
  remoteQuality: number;
  reputation: number;
  techStack: number;
  speedToOffer: number;
  culturalSignals: number;
  total: number;
}

// ── Pain Map ─────────────────────────────────────────────────

export interface PainMap {
  corePain: string;
  urgencySignal: string;
  aiGap: string;
  matchScore: number;
  matchReason: string;
}

// ── Outreach ─────────────────────────────────────────────────

export interface LinkedInOutreach {
  connectionRequest: string;
  followUpDm: string;
  followUpNudge: string;
}

export interface EmailOutreach {
  emailSubject: string;
  emailBody: string;
  emailPS: string;
  followUp1: string;
  breakupEmail: string;
}

export interface WhatsAppOutreach {
  whatsappMessage: string;
  whatsappFollowUp: string;
}

export interface OutreachSet {
  linkedin?: LinkedInOutreach;
  email?: EmailOutreach;
  whatsapp?: WhatsAppOutreach;
  strategyId?: string;
}

// ── Message Scoring ──────────────────────────────────────────

export type MessageVerdict =
  | "excellent"
  | "good"
  | "acceptable"
  | "weak"
  | "fail";

export interface MessageScore {
  brevity: number;
  readability: number;
  tone: number;
  ctaQuality: number;
  antiPatterns: number;
  subjectLine: number;
  channelFit: number;
  total: number;
  hardFail: boolean;
  hardFailReason?: string;
  verdict: MessageVerdict;
  sendReady: boolean;
}

// ── Pipeline State ───────────────────────────────────────────

export interface PipelineResult {
  companiesResearched: number;
  jobsDiscovered: number;
  jobsScored: number;
  jobsPassed: number;
  dmsFound: number;
  draftsGenerated: number;
  highConfidenceMatches: number;
}
