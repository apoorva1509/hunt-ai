// Type-safe shapes for the untyped `data: v.any()` fields in agentItems

export interface JobLeadData {
  company: string;
  role: string;
  url: string;
  jobBoard: string;
  salary?: number;
  location?: string;
  workMode?: "remote" | "hybrid" | "onsite" | "unknown";
  matchScore: number;
  matchReason: string;
  corePain: string;
  urgencySignal: string;
  aiGap: string;
  fundingStage?: string;
  techStack: string[];
  competitors: string[];
  archetype: string;
  fullDescription?: string;
  scoreDimensions: {
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
  };
  compensationRange?: {
    min?: number;
    max?: number;
    currency: string;
  };
}

export interface ContactData {
  name: string;
  title: string;
  linkedinUrl?: string;
  email?: string;
  phone?: string;
  headline?: string;
  recentFocus?: string;
  careerHistory?: string[];
}

export interface OutreachDraftData {
  channel: "linkedin" | "email" | "whatsapp";
  body: string;
  subject?: string;
  ps?: string;
  charCount?: number;
  sendAfter?: string;
  sequenceStep?: number;
  approvalRequired?: boolean;
  strategyId?: string;
  messageScore?: {
    total: number;
    verdict: string;
    sendReady: boolean;
  };
}
