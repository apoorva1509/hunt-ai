import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requirePerson } from "./helpers/auth";

const sourceValidator = v.union(
  v.literal("linkedin"),
  v.literal("careers_page"),
  v.literal("greenhouse"),
  v.literal("lever"),
  v.literal("ashby"),
  v.literal("workable"),
  v.literal("yc"),
  v.literal("wellfound"),
  v.literal("instahyre"),
  v.literal("naukri")
);

const statusValidator = v.union(
  v.literal("new"),
  v.literal("applied"),
  v.literal("skipped")
);

const workModeValidator = v.optional(
  v.union(
    v.literal("remote"),
    v.literal("hybrid"),
    v.literal("onsite"),
    v.literal("unknown")
  )
);

export const listByCompany = query({
  args: { companyId: v.id("outreachCompanies") },
  handler: async (ctx, { companyId }) => {
    return await ctx.db
      .query("outreachJobs")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .order("desc")
      .collect();
  },
});

export const countByCompany = query({
  args: { companyId: v.id("outreachCompanies") },
  handler: async (ctx, { companyId }) => {
    const jobs = await ctx.db
      .query("outreachJobs")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
    const total = jobs.length;
    const newCount = jobs.filter((j) => j.status === "new").length;
    const applied = jobs.filter((j) => j.status === "applied").length;
    return { total, new: newCount, applied };
  },
});

export const markApplied = mutation({
  args: {
    id: v.id("outreachJobs"),
    appliedVia: v.optional(v.string()),
    appliedNotes: v.optional(v.string()),
  },
  handler: async (ctx, { id, appliedVia, appliedNotes }) => {
    await requirePerson(ctx);
    const job = await ctx.db.get(id);
    if (!job) throw new Error("Job not found");

    await ctx.db.patch(id, {
      status: "applied",
      appliedAt: Date.now(),
      appliedVia,
      appliedNotes,
      updatedAt: Date.now(),
    });

    // Auto-mark matching pipeline step as done by keyword in step label
    const steps = await ctx.db
      .query("outreachSteps")
      .withIndex("by_company", (q) => q.eq("companyId", job.companyId))
      .collect();

    const jobTitleLower = job.title.toLowerCase();
    const sourceLower = (appliedVia ?? job.source).toLowerCase();

    for (const step of steps) {
      if (step.status === "pending") {
        const labelLower = step.label.toLowerCase();
        const matches =
          labelLower.includes("apply") &&
          (labelLower.includes(sourceLower) ||
            labelLower.includes(jobTitleLower) ||
            (job.source === "linkedin" && labelLower.includes("linkedin")) ||
            (job.source === "careers_page" && labelLower.includes("portal")) ||
            (job.source === "yc" && labelLower.includes("yc")));
        if (matches) {
          await ctx.db.patch(step._id, {
            status: "done",
            updatedAt: Date.now(),
          });
          break;
        }
      }
    }
  },
});

export const markSkipped = mutation({
  args: { id: v.id("outreachJobs") },
  handler: async (ctx, { id }) => {
    await requirePerson(ctx);
    await ctx.db.patch(id, {
      status: "skipped",
      updatedAt: Date.now(),
    });
  },
});

export const batchCreate = internalMutation({
  args: {
    jobs: v.array(
      v.object({
        companyId: v.id("outreachCompanies"),
        title: v.string(),
        url: v.string(),
        source: sourceValidator,
        location: v.optional(v.string()),
        workMode: workModeValidator,
        description: v.optional(v.string()),
        postedAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, { jobs }) => {
    const existing = jobs.length > 0
      ? await ctx.db
          .query("outreachJobs")
          .withIndex("by_company", (q) =>
            q.eq("companyId", jobs[0].companyId)
          )
          .collect()
      : [];

    const existingKeys = new Set(
      existing.map((j) => `${j.title.toLowerCase()}::${j.source}`)
    );

    const inserted: string[] = [];
    for (const job of jobs) {
      const key = `${job.title.toLowerCase()}::${job.source}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      const id = await ctx.db.insert("outreachJobs", {
        ...job,
        status: "new",
        updatedAt: Date.now(),
      });
      inserted.push(id);
    }
    return inserted;
  },
});
