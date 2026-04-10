import type { DiscoveredJob } from "../types.js";

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
  "linkedin",
  "yc_wats",
  "wellfound",
  "naukri",
  "instahyre",
  "cutshort",
  "hn_hiring",
  "topstartups",
];

export interface SourceQuery {
  keywords: string[];
  negativeKeywords: string[];
  location: string;
  remote: boolean;
}

export interface SourceAdapter {
  id: SourceId;
  name: string;
  search(query: SourceQuery): Promise<DiscoveredJob[]>;
}
