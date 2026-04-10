import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

/**
 * Get the current authenticated person record.
 * Returns null if not authenticated or person not found.
 */
export async function getCurrentPerson(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"people"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("people")
    .withIndex("by_clerk_token", (q) =>
      q.eq("clerkTokenIdentifier", identity.tokenIdentifier)
    )
    .first();
}

/**
 * Get the current authenticated person, throw if not found.
 */
export async function requirePerson(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"people">> {
  const person = await getCurrentPerson(ctx);
  if (!person) {
    throw new Error("Authentication required");
  }
  return person;
}
