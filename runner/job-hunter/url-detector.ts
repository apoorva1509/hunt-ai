/**
 * Detect URL type for tracker processing.
 * Returns the type and extracted metadata.
 */

export interface UrlInfo {
  type: "linkedin_company" | "job_posting";
  slug?: string;       // LinkedIn company slug
  company?: string;    // Extracted company name (humanized slug)
  jobBoard?: string;   // Detected job board (greenhouse, lever, ashby, etc.)
}

const LINKEDIN_COMPANY_RE = /linkedin\.com\/company\/([^\/\?#]+)/i;
const GREENHOUSE_RE = /(?:boards\.greenhouse\.io|job-boards\.(?:eu\.)?greenhouse\.io)\/([^\/\?#]+)/i;
const LEVER_RE = /jobs\.lever\.co\/([^\/\?#]+)/i;
const ASHBY_RE = /jobs\.ashbyhq\.com\/([^\/\?#]+)/i;
const WORKABLE_RE = /apply\.workable\.com\/([^\/\?#]+)/i;

function slugToName(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function detectUrlType(url: string): UrlInfo {
  // LinkedIn company page
  const liMatch = url.match(LINKEDIN_COMPANY_RE);
  if (liMatch) {
    const slug = liMatch[1].toLowerCase();
    // Exclude job postings on LinkedIn (linkedin.com/company/x/jobs/...)
    if (!/\/jobs\/\d/.test(url)) {
      return {
        type: "linkedin_company",
        slug,
        company: slugToName(slug),
      };
    }
  }

  // Job board detection
  const ghMatch = url.match(GREENHOUSE_RE);
  if (ghMatch) {
    return {
      type: "job_posting",
      company: slugToName(ghMatch[1]),
      jobBoard: "greenhouse",
    };
  }

  const leverMatch = url.match(LEVER_RE);
  if (leverMatch) {
    return {
      type: "job_posting",
      company: slugToName(leverMatch[1]),
      jobBoard: "lever",
    };
  }

  const ashbyMatch = url.match(ASHBY_RE);
  if (ashbyMatch) {
    return {
      type: "job_posting",
      company: slugToName(ashbyMatch[1]),
      jobBoard: "ashby",
    };
  }

  const workableMatch = url.match(WORKABLE_RE);
  if (workableMatch) {
    return {
      type: "job_posting",
      company: slugToName(workableMatch[1]),
      jobBoard: "workable",
    };
  }

  // Default: treat as job posting
  return { type: "job_posting" };
}
