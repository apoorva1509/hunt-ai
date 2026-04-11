/**
 * Tracker URL Processor — processes pending URLs from the tracker.
 *
 * Handles two URL types:
 * - LinkedIn company pages: discover jobs, build intel, find DMs, create leads
 * - Job posting URLs: scrape JD, classify, score, find DMs, create leads
 */

import {
  loadAgentConfigById,
  createItemForAgent,
  getPendingTrackerUrls,
  markTrackerProcessing,
  markTrackerEvaluated,
  markTrackerFailed,
} from "./convex-client.js";
import {
  buildCompanyIntel,
  searchForDecisionMakers,
  deepResearchDM,
  discoverJobsFromCompany,
} from "./research.js";
import { scrapeJD } from "./jd-scraper.js";
import { classifyArchetype } from "./archetype-classifier.js";
import { scoreJob } from "./job-scoring.js";
import { synthesizePainMap } from "./messages.js";
import { closeBrowser } from "./linkedin.js";
import { detectUrlType } from "./url-detector.js";
import type {
  ClassifiedJob,
  DiscoveredJob,
  OutreachStrategy,
  AgentConfig,
} from "./types.js";

type WriteItemFn = (args: {
  runId?: string;
  parentId?: string;
  type: string;
  title: string;
  subtitle?: string;
  data: any;
  actions?: string[];
}) => Promise<string>;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function processTrackerUrls() {
  const pending = await getPendingTrackerUrls();
  if (pending.length === 0) return;

  console.log(`\n[tracker] ${pending.length} pending tracker URL(s)`);

  for (const item of pending) {
    const claimed = await markTrackerProcessing(item._id);
    if (!claimed) {
      console.log(`[tracker] ${item._id} already claimed, skipping`);
      continue;
    }

    const url = claimed.url;
    const agentId = claimed.agentId;
    console.log(`[tracker] Processing: ${url}`);

    try {
      const { config, strategies } = await loadAgentConfigById(agentId);
      const writeItem = createItemForAgent(agentId);
      const urlInfo = detectUrlType(url);

      if (urlInfo.type === "linkedin_company") {
        await processLinkedInCompany(
          item._id,
          url,
          urlInfo.company ?? urlInfo.slug ?? "Unknown",
          urlInfo.slug,
          config,
          strategies,
          writeItem
        );
      } else {
        await processJobPostingUrl(
          item._id,
          url,
          urlInfo,
          config,
          strategies,
          writeItem
        );
      }
    } catch (err) {
      console.error(`[tracker] Failed: ${(err as Error).message}`);
      await markTrackerFailed(item._id, (err as Error).message);
    } finally {
      await closeBrowser();
    }

    await sleep(2000);
  }
}

async function processLinkedInCompany(
  trackerId: string,
  url: string,
  companyName: string,
  companySlug: string | undefined,
  config: AgentConfig,
  strategies: OutreachStrategy[],
  writeItem: WriteItemFn
) {
  console.log(`[tracker] LinkedIn company: ${companyName}`);

  const discoveredJobs = await discoverJobsFromCompany(companyName, companySlug);
  console.log(`[tracker] Found ${discoveredJobs.length} job(s) for ${companyName}`);

  const intel = await buildCompanyIntel(companyName);
  console.log(`[tracker] Intel: ${intel.fundingStage ?? "?"} | AI: ${intel.aiMaturity}`);

  const rawDMs = await searchForDecisionMakers(companyName);
  console.log(`[tracker] DMs found: ${rawDMs.length}`);

  let leadsCreated = 0;

  if (discoveredJobs.length > 0) {
    for (const job of discoveredJobs.slice(0, 5)) {
      try {
        const jdText = await scrapeJD(job);
        if (!jdText) {
          console.log(`[tracker] Could not scrape JD for ${job.url}, skipping`);
          continue;
        }

        const archetype = await classifyArchetype(jdText);
        const classifiedJob: ClassifiedJob = {
          ...job,
          archetype: archetype.id,
          archetypeConfidence: archetype.method,
          jdText,
          isLive: true,
          workMode: "unknown",
        };

        const scores = await scoreJob(
          classifiedJob,
          intel,
          config.resumeText,
          config.candidateProfile.positioning
        );
        console.log(`[tracker] Score: ${scores.total}/100 — ${job.role}`);

        const painMap = await synthesizePainMap(classifiedJob, intel, config.resumeText);

        const leadId = await writeItem({
          type: "job_lead",
          title: `${job.company} — ${job.role}`,
          subtitle: `Score: ${scores.total}/100 | ${archetype.id}`,
          data: {
            company: job.company,
            role: job.role,
            url: job.url,
            jobBoard: job.jobBoard,
            salary: job.salary,
            location: classifiedJob.location,
            workMode: classifiedJob.workMode,
            matchScore: scores.total,
            matchReason: painMap.matchReason,
            corePain: painMap.corePain,
            urgencySignal: painMap.urgencySignal,
            aiGap: painMap.aiGap,
            fundingStage: intel.fundingStage,
            techStack: intel.techStack,
            archetype: archetype.id,
            fullDescription: jdText.slice(0, 4000),
            scoreDimensions: scores,
            source: "tracker",
          },
          actions: ["approve", "skip"],
        });
        leadsCreated++;

        await attachDMsToLead(leadId, rawDMs.slice(0, 3), companyName, painMap, strategies, config, writeItem);
      } catch (err) {
        console.error(`[tracker] Job processing failed: ${(err as Error).message}`);
      }
    }
  } else {
    const leadId = await writeItem({
      type: "target_company",
      title: companyName,
      subtitle: `${rawDMs.length} DM(s) found | No open roles discovered`,
      data: {
        company: companyName,
        linkedinUrl: url,
        fundingStage: intel.fundingStage,
        aiMaturity: intel.aiMaturity,
        techStack: intel.techStack,
        painPoints: intel.painPoints,
        dmsFound: rawDMs.length,
        source: "tracker",
      },
      actions: ["approve", "skip"],
    });

    await attachDMsToLead(leadId, rawDMs.slice(0, 3), companyName, null, strategies, config, writeItem);
  }

  await markTrackerEvaluated(trackerId, {
    company: companyName,
    notes: `${discoveredJobs.length} job(s) found, ${leadsCreated} lead(s) created, ${rawDMs.length} DM(s)`,
  });
  console.log(`[tracker] Done: ${companyName} — ${leadsCreated} leads, ${rawDMs.length} DMs`);
}

async function processJobPostingUrl(
  trackerId: string,
  url: string,
  urlInfo: { company?: string; jobBoard?: string },
  config: AgentConfig,
  strategies: OutreachStrategy[],
  writeItem: WriteItemFn
) {
  const stubJob: DiscoveredJob = {
    company: urlInfo.company ?? "Unknown",
    role: "Unknown",
    url,
    jobBoard: "other",
  };

  const jdText = await scrapeJD(stubJob);
  if (!jdText) {
    await markTrackerFailed(trackerId, "Could not scrape job description from URL");
    return;
  }

  const archetype = await classifyArchetype(jdText);
  const extractedTitle = extractTitleFromJD(jdText);
  const companyName = urlInfo.company ?? extractCompanyFromJD(jdText) ?? "Unknown";
  const role = extractedTitle ?? "Unknown Role";

  console.log(`[tracker] ${companyName} — ${role} (${archetype.id})`);

  const intel = await buildCompanyIntel(companyName);
  const rawDMs = await searchForDecisionMakers(companyName);

  const location = extractField(jdText, /location[:\s]+([^\n]+)/i);
  const workMode = detectWorkMode(jdText);
  const salary = extractField(jdText, /(?:salary|compensation|pay)[:\s]+([^\n]+)/i);

  const classifiedJob: ClassifiedJob = {
    company: companyName,
    role,
    url,
    jobBoard: "other",
    archetype: archetype.id,
    archetypeConfidence: archetype.method,
    jdText,
    isLive: true,
    location,
    workMode,
  };

  const scores = await scoreJob(
    classifiedJob,
    intel,
    config.resumeText,
    config.candidateProfile.positioning
  );
  console.log(`[tracker] Score: ${scores.total}/100`);

  const painMap = await synthesizePainMap(classifiedJob, intel, config.resumeText);

  const leadId = await writeItem({
    type: "job_lead",
    title: `${companyName} — ${role}`,
    subtitle: `Score: ${scores.total}/100 | ${archetype.id}`,
    data: {
      company: companyName,
      role,
      url,
      jobBoard: urlInfo.jobBoard ?? "other",
      location,
      workMode,
      salary,
      matchScore: scores.total,
      matchReason: painMap.matchReason,
      corePain: painMap.corePain,
      urgencySignal: painMap.urgencySignal,
      aiGap: painMap.aiGap,
      fundingStage: intel.fundingStage,
      techStack: intel.techStack,
      archetype: archetype.id,
      fullDescription: jdText.slice(0, 4000),
      scoreDimensions: scores,
      source: "tracker",
    },
    actions: ["approve", "skip"],
  });

  await attachDMsToLead(leadId, rawDMs.slice(0, 3), companyName, painMap, strategies, config, writeItem);

  await markTrackerEvaluated(trackerId, {
    title: role,
    company: companyName,
    score: scores.total,
    archetype: archetype.id,
    location,
    workMode,
    salary,
    notes: `${rawDMs.length} DM(s) found`,
  });
  console.log(`[tracker] Done: ${companyName} — ${role} — ${scores.total}/100`);
}

async function attachDMsToLead(
  leadId: string,
  dms: Array<{ name: string; title: string; email?: string; source: "linkedin" | "email" | "web"; linkedinUrl: string }>,
  companyName: string,
  _painMap: any | null,
  _strategies: OutreachStrategy[],
  _config: AgentConfig,
  writeItem: WriteItemFn
) {
  if (dms.length === 0) {
    console.log(`[tracker] No DMs to attach for ${companyName}`);
    return;
  }

  for (const rawDM of dms) {
    try {
      const dm = await deepResearchDM({ ...rawDM, company: companyName });

      // Write contact to Convex (outreach is generated on-demand from the UI)
      await writeItem({
        parentId: leadId,
        type: "contact",
        title: dm.name,
        subtitle: dm.title,
        data: {
          name: dm.name,
          title: dm.title,
          linkedinUrl: dm.linkedinUrl,
          email: dm.email,
          phone: dm.phone,
          headline: dm.headline,
          recentFocus: dm.recentFocus,
          careerHistory: dm.careerHistory,
        },
        actions: ["connection_request", "email", "skip"],
      });
    } catch (err) {
      console.error(`[tracker] DM failed for ${rawDM.name}: ${(err as Error).message}`);
    }
  }
}

function extractTitleFromJD(jdText: string): string | null {
  const patterns = [
    /^#\s*(.+)/m,
    /job\s*title[:\s]+(.+)/i,
    /position[:\s]+(.+)/i,
    /role[:\s]+(.+)/i,
  ];
  for (const pat of patterns) {
    const m = jdText.match(pat);
    if (m) return m[1].trim().slice(0, 120);
  }
  return null;
}

function extractCompanyFromJD(jdText: string): string | null {
  const patterns = [
    /company[:\s]+(.+)/i,
    /about\s+(\w[\w\s]{1,30})\s*\n/i,
  ];
  for (const pat of patterns) {
    const m = jdText.match(pat);
    if (m) return m[1].trim().slice(0, 60);
  }
  return null;
}

function extractField(text: string, pattern: RegExp): string | undefined {
  const m = text.match(pattern);
  return m ? m[1].trim() : undefined;
}

function detectWorkMode(text: string): "remote" | "hybrid" | "onsite" | "unknown" {
  const lower = text.toLowerCase();
  if (/\bfully?\s*remote\b/.test(lower)) return "remote";
  if (/\bremote[\s-]*first\b/.test(lower)) return "remote";
  if (/\bhybrid\b/.test(lower)) return "hybrid";
  if (/\bon[\s-]*site\b|\bin[\s-]*office\b/.test(lower)) return "onsite";
  return "unknown";
}
