export type SourceId =
  | "linkedin"
  | "yc_wats"
  | "wellfound"
  | "naukri"
  | "instahyre"
  | "cutshort"
  | "hn_hiring"
  | "topstartups";

export const SOURCE_NAMES: Record<SourceId, string> = {
  linkedin: "LinkedIn",
  yc_wats: "YC Work at a Startup",
  wellfound: "Wellfound",
  naukri: "Naukri",
  instahyre: "Instahyre",
  cutshort: "Cutshort",
  hn_hiring: "HN Who's Hiring",
  topstartups: "TopStartups.io",
};

export const ALL_SOURCES: SourceId[] = [
  "linkedin", "yc_wats", "wellfound", "naukri",
  "instahyre", "cutshort", "hn_hiring", "topstartups",
];

export interface CompanyFilter {
  max_size?: number;
  funding?: string;
  exclude_mncs?: boolean;
}

export interface PipelineSettings {
  filter_by_score: boolean;
  min_score: number;
}

export interface TitleFilter {
  positive: string[];
  negative: string[];
}

export interface ProfileSummary {
  slug: string;
  active: boolean;
  location: string;
  remote: boolean;
  enabledSources: number;
  totalSources: number;
  sources: SourceId[];
  keywordCount: number;
  companyFilter: CompanyFilter;
}

export interface ProfileDetail {
  slug: string;
  active: boolean;
  location: string;
  remote: boolean;
  titleFilter: TitleFilter;
  sources: SourceId[];
  companyFilter: CompanyFilter;
  pipelineSettings: PipelineSettings;
  rawContent: string;
}

export interface CandidateData {
  candidate: Record<string, string>;
  compensation: Record<string, string>;
  location: Record<string, string>;
  narrative: Record<string, string>;
  target_roles: string;
  cv: string;
}
