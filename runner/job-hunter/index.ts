import "dotenv/config";

/**
 * Job Hunter Runner — Full Pipeline Orchestrator
 *
 * Phases:
 * 1. Load config from Convex
 * 2. Discover jobs (search + parse + deduplicate)
 * 2b. Liveness check + JD scrape + archetype classification
 * 3. Company intelligence (7 parallel searches per company)
 * 4. Decision maker discovery
 * 5. Deep research per DM (web + LinkedIn + LLM synthesis)
 * 6. 10-dimension job scoring
 * 7. Pain map synthesis
 * 8. Outreach generation + quality scoring
 * 9. Write results to Convex
 *
 * Usage:
 *   npx tsx index.ts          # Standalone mode (uses AGENT_ID env var)
 *   npx tsx index.ts --watch  # Watch mode (polls Convex for pending runs)
 */

import {
  loadAgentConfig,
  loadAgentConfigById,
  startRun,
  finishRun,
  createItem,
  createItemForAgent,
  patchItemData,
  getPendingRuns,
  claimRun,
} from "./convex-client.js";
import {
  discoverJobs,
  processJobs,
  buildCompanyIntel,
  searchForDecisionMakers,
  deepResearchDM,
} from "./research.js";
import { scoreJob } from "./job-scoring.js";
import { synthesizePainMap } from "./messages.js";
import { closeBrowser } from "./linkedin.js";
import { loadPipelineSettings } from "./portal-scanner.js";
import { processTrackerUrls } from "./tracker-processor.js";
import type { PipelineResult, ClassifiedJob, OutreachStrategy, AgentConfig } from "./types.js";
const MAX_COMPANIES = parseInt(process.env.MAX_COMPANIES ?? "12", 10);
const MAX_DMS_PER_COMPANY = 5;

// ── Core Pipeline (shared by standalone and watch mode) ─────

async function runPipeline(
  runId: string,
  config: AgentConfig,
  strategies: OutreachStrategy[],
  writeItem: (args: {
    runId?: string;
    parentId?: string;
    type: string;
    title: string;
    subtitle?: string;
    data: any;
    actions?: string[];
  }) => Promise<string>
) {
  // ── Load pipeline settings ────────────────────────────
  const pipelineSettings = loadPipelineSettings();
  const filterByScore = pipelineSettings.filter_by_score;
  const minScore = pipelineSettings.min_score;
  console.log(`[config] Score filter: ${filterByScore ? `enabled (min ${minScore})` : "disabled"}\n`);

  // ── Phase 2: Discover Jobs ─────────────────────────────
  console.log("[phase 2] Discovering jobs...");
  const rawJobs = await discoverJobs(config);
  console.log(`  Found ${rawJobs.length} unique jobs\n`);

  // ── Phase 2b: Liveness + Scraping + Classification ─────
  console.log("[phase 2b] Processing jobs (liveness, scraping, classification)...");
  const classifiedJobs = await processJobs(rawJobs);
  console.log(`  ${classifiedJobs.length} live, classified jobs\n`);

  // Group by company
  const byCompany = new Map<string, ClassifiedJob[]>();
  for (const job of classifiedJobs) {
    const key = job.company.toLowerCase();
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key)!.push(job);
  }

  // Source quality weights — structured job boards > aggregators > forums
  const SOURCE_QUALITY: Record<string, number> = {
    linkedin: 5, wellfound: 5, yc_wats: 4, instahyre: 3,
    cutshort: 3, naukri: 3, topstartups: 2, hn_hiring: 1, other: 1,
  };

  // Rank companies: roles × source quality, then by source diversity
  const rankedCompanies = [...byCompany.entries()]
    .map(([key, jobs]) => {
      const sources = new Set(jobs.map((j) => j.jobBoard));
      const bestSourceScore = Math.max(...jobs.map((j) => SOURCE_QUALITY[j.jobBoard] ?? 1));
      return { key, jobs, roleCount: jobs.length, sourceCount: sources.size, bestSourceScore };
    })
    .sort((a, b) => {
      // First by number of roles (descending)
      if (b.roleCount !== a.roleCount) return b.roleCount - a.roleCount;
      // Then by best source quality (descending) — prefer LinkedIn/Wellfound over HN
      if (b.bestSourceScore !== a.bestSourceScore) return b.bestSourceScore - a.bestSourceScore;
      // Then by source diversity (descending)
      return b.sourceCount - a.sourceCount;
    });

  const companyNames = rankedCompanies.slice(0, MAX_COMPANIES).map((c) => c.key);
  console.log(`[phase 3-8] Processing top ${companyNames.length} companies (of ${byCompany.size} total)...`);
  console.log(`  Top companies: ${rankedCompanies.slice(0, MAX_COMPANIES).map((c) => `${c.jobs[0].company} (${c.roleCount} roles)`).join(", ")}\n`);

  const stats: PipelineResult = {
    companiesResearched: 0,
    jobsDiscovered: rawJobs.length,
    jobsScored: 0,
    jobsPassed: 0,
    dmsFound: 0,
    draftsGenerated: 0,
    highConfidenceMatches: 0,
  };

  // Funnel tracking for UI summary
  const funnel = {
    jobsFromSources: rawJobs.length,
    afterTitleFilter: rawJobs.length, // scanner already filtered, so this equals rawJobs
    afterDedup: rawJobs.length,
    liveJobs: classifiedJobs.length,
    totalCompanies: byCompany.size,
    companiesProcessed: companyNames.length,
    companiesWithDMs: 0,
    companiesNoDMs: 0,
    jobsScored: 0,
    jobsBelowThreshold: 0,
    leadsCreated: 0,
  };

  // ── Per-Company Pipeline ───────────────────────────────
  for (const companyKey of companyNames) {
    const jobs = byCompany.get(companyKey)!;
    const companyName = jobs[0].company;
    console.log(`\n--- ${companyName} (${jobs.length} roles) ---`);

    // Phase 3: Company Intelligence
    const intel = await buildCompanyIntel(companyName);
    stats.companiesResearched++;
    console.log(
      `  Intel: ${intel.fundingStage ?? "?"} | AI: ${intel.aiMaturity} | Pain: ${intel.painPoints.length}`
    );

    // Phase 5: Decision Maker Discovery (multi-channel: LinkedIn + email + web)
    const rawDMs = await searchForDecisionMakers(companyName);
    stats.dmsFound += rawDMs.length;
    const dmSources = rawDMs.map((d) => d.source).filter((v, i, a) => a.indexOf(v) === i);
    console.log(`  DMs found: ${rawDMs.length}${dmSources.length > 0 ? ` (${dmSources.join(", ")})` : ""}`);

    if (rawDMs.length === 0) {
      funnel.companiesNoDMs++;
    } else {
      funnel.companiesWithDMs++;
    }

    for (const job of jobs) {
      // Phase 6: Score
      const scores = await scoreJob(
        job,
        intel,
        config.resumeText,
        config.candidateProfile.positioning
      );
      stats.jobsScored++;
      console.log(`  Score: ${scores.total}/100 — ${job.role}`);

      funnel.jobsScored++;
      if (filterByScore && scores.total < minScore) {
        console.log(`  SKIP (below ${minScore})`);
        funnel.jobsBelowThreshold++;
        continue;
      }
      stats.jobsPassed++;
      if (scores.total >= 80) stats.highConfidenceMatches++;

      // Phase 7: Pain Map
      let painMap;
      try {
        painMap = await synthesizePainMap(job, intel, config.resumeText);
      } catch (err) {
        console.warn(`  WARN: Pain map failed for ${job.role}: ${(err as Error).message}`);
        continue;
      }
      console.log(`  Pain: ${painMap.corePain.slice(0, 80)}...`);

      // Write job_lead to Convex
      let leadId: string;
      try {
        leadId = await writeItem({
          runId,
          type: "job_lead",
          title: `${job.company} — ${job.role}`,
          subtitle: `Score: ${scores.total}/100 | ${job.archetype}`,
          data: {
            company: job.company,
            role: job.role,
            url: job.url,
            jobBoard: job.jobBoard,
            salary: job.salary,
            location: job.location,
            workMode: job.workMode,
            matchScore: scores.total,
            matchReason: painMap.matchReason,
            corePain: painMap.corePain,
            urgencySignal: painMap.urgencySignal,
            aiGap: painMap.aiGap,
            fundingStage: intel.fundingStage,
            techStack: intel.techStack,
            competitors: intel.competitors,
            archetype: job.archetype,
            fullDescription: job.jdText?.slice(0, 4000),
            scoreDimensions: scores,
            compensationRange: intel.compensationRange,
          },
          actions: ["approve", "skip"],
        });
      } catch (err) {
        console.error(`  ERROR: Failed to write lead for ${job.company} — ${job.role}: ${(err as Error).message}`);
        continue;
      }
      // Only count as created AFTER successful write
      funnel.leadsCreated++;
      console.log(`  Lead created: ${leadId}`);

      // Phase 6 + 8: Deep research + Outreach per DM
      if (rawDMs.length === 0) {
        console.log(`    No DMs found — lead created without outreach`);
      }
      const dmsToProcess = rawDMs.slice(0, MAX_DMS_PER_COMPANY);

      for (const rawDM of dmsToProcess) {
        console.log(`    DM: ${rawDM.name} (${rawDM.title})${rawDM.email ? ` [${rawDM.email}]` : ""} via ${rawDM.source}`);

        try {
          // Phase 6: Deep Research per DM
          const dm = await deepResearchDM({
            ...rawDM,
            company: companyName,
          });

          // Write contact to Convex (outreach is generated on-demand from the UI)
          await writeItem({
            runId,
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
          console.error(`    ERROR: DM processing failed for ${rawDM.name}: ${(err as Error).message}`);
        }
      }
    }

    // Rate limiting between companies
    await sleep(randomBetween(2000, 3000));
  }

  // ── Complete Run ───────────────────────────────────────
  const summaryObj = {
    text: `Researched ${stats.companiesResearched} companies. Found ${stats.dmsFound} DMs. ${funnel.leadsCreated} leads.`,
    funnel,
    stats,
  };
  const summary = JSON.stringify(summaryObj);
  console.log(`\n=== Complete ===`);
  console.log(`${summaryObj.text}`);
  console.log(`\nFunnel: ${funnel.liveJobs} jobs → ${funnel.totalCompanies} companies → ${funnel.companiesProcessed} processed → ${funnel.companiesWithDMs} had DMs → ${funnel.jobsScored} scored → ${funnel.leadsCreated} leads`);

  await finishRun(runId, "completed", summary);
}

// ── Standalone Mode (original) ──────────────────────────────

async function main() {
  console.log("=== Job Hunter Pipeline ===\n");
  let runId: string | undefined;

  try {
    // ── Phase 1: Load Config ───────────────────────────────
    console.log("[phase 1] Loading agent config...");
    const { config, strategies } = await loadAgentConfig();
    console.log(
      `  Roles: ${config.targetRoles.join(", ")}`,
      `\n  Min pay: $${config.preferredPay}`,
      `\n  Strategies: ${strategies.length} active`
    );

    runId = await startRun("manual");
    if (!runId) throw new Error("Failed to start run");
    console.log(`  Run started: ${runId}\n`);

    await runPipeline(runId, config, strategies, createItem);
  } catch (err) {
    console.error("Pipeline failed:", err);
    if (runId) {
      await finishRun(runId, "failed", undefined, (err as Error).message);
    }
    process.exit(1);
  } finally {
    await closeBrowser();
  }
}

// ── Watch Mode (polls Convex for pending runs) ──────────────

async function watchMode() {
  console.log("=== Job Hunter Watcher (polling every 5s) ===\n");

  while (true) {
    try {
      const pending = await getPendingRuns();

      for (const run of pending) {
        console.log(
          `\n[watch] Claiming run ${run._id} (agent: ${run.agentId})...`
        );
        const claimed = await claimRun(run._id);
        if (!claimed) {
          console.log(`[watch] Run ${run._id} already claimed, skipping`);
          continue;
        }

        console.log(
          `[watch] Running pipeline for agent ${claimed.agentId}...`
        );
        try {
          const { config, strategies } = await loadAgentConfigById(
            claimed.agentId
          );
          const writeItem = createItemForAgent(claimed.agentId);
          await runPipeline(run._id, config, strategies, writeItem);
        } catch (err) {
          console.error(`[watch] Pipeline failed for run ${run._id}:`, err);
          await finishRun(
            run._id,
            "failed",
            undefined,
            (err as Error).message
          );
        } finally {
          await closeBrowser();
        }
      }
    } catch (err) {
      console.error("[watch] Poll error:", err);
    }

    // Process pending tracker URLs
    try {
      await processTrackerUrls();
    } catch (err) {
      console.error("[watch] Tracker poll error:", err);
    }

    await sleep(5000);
  }
}

// ── Helpers ─────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Entry Point ─────────────────────────────────────────────

if (process.argv.includes("--watch")) {
  watchMode();
} else {
  main();
}
