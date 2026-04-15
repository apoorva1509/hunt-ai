import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getCurrentPerson } from "./auth";

export type AccessRole =
  | "owner"
  | "grantee"
  | "published"
  | "runner"
  | null;

/**
 * Check what access level the current user has to an agent.
 *
 * - owner: the person who created the agent
 * - grantee: person or company granted access via agentAccess
 * - published: agent is published (marketplace)
 * - runner: unauthenticated but allowed for runner-facing endpoints
 * - null: no access
 */
export async function checkAgentAccess(
  ctx: QueryCtx | MutationCtx,
  agentId: Id<"agents">
): Promise<AccessRole> {
  const agent = await ctx.db.get(agentId);
  if (!agent) return null;

  const person = await getCurrentPerson(ctx);

  if (!person) {
    if (agent.isPublished) return "published";
    return "runner";
  }

  // Owner check
  if (agent.ownerPersonId === person._id) return "owner";

  // Direct person grant
  const personGrant = await ctx.db
    .query("agentAccess")
    .withIndex("by_person", (q) => q.eq("personId", person._id))
    .filter((q) => q.eq(q.field("agentId"), agentId))
    .first();
  if (personGrant) return "grantee";

  // Company grant — check if person's companies have access
  const personCompanyLinks = await ctx.db
    .query("personCompanyLinks")
    .withIndex("by_person_and_status", (q) =>
      q.eq("personId", person._id).eq("status", "active")
    )
    .collect();

  for (const link of personCompanyLinks) {
    const companyGrant = await ctx.db
      .query("agentAccess")
      .withIndex("by_company", (q) => q.eq("companyId", link.companyId))
      .filter((q) => q.eq(q.field("agentId"), agentId))
      .first();
    if (companyGrant) return "grantee";
  }

  if (agent.isPublished) return "published";

  return null;
}

/**
 * Require owner access, throw otherwise.
 */
export async function requireOwner(
  ctx: QueryCtx | MutationCtx,
  agentId: Id<"agents">
): Promise<void> {
  const role = await checkAgentAccess(ctx, agentId);
  if (role !== "owner") {
    throw new Error("Owner access required");
  }
}
