import { action, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { encrypt, decrypt } from "./helpers/encryption";
import { api } from "./_generated/api";

export const setSecret = action({
  args: {
    agentId: v.id("agents"),
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, { agentId, key, value }) => {
    const { iv, ciphertext } = await encrypt(value);

    // Check if secret already exists
    const existing = await ctx.runQuery(
      api.secrets.getSecretRecord,
      { agentId, key }
    );

    if (existing) {
      await ctx.runMutation(api.secrets.patchSecret, {
        id: existing._id,
        iv,
        ciphertext,
      });
    } else {
      await ctx.runMutation(api.secrets.insertSecret, {
        agentId,
        key,
        iv,
        ciphertext,
      });
    }
  },
});

export const getSecret = action({
  args: {
    agentId: v.id("agents"),
    key: v.string(),
  },
  handler: async (ctx, { agentId, key }) => {
    const record = await ctx.runQuery(
      api.secrets.getSecretRecord,
      { agentId, key }
    );
    if (!record) return null;
    return await decrypt(record.iv, record.ciphertext);
  },
});

export const getSecretKeys = action({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const records = await ctx.runQuery(
      api.secrets.listSecretKeys,
      { agentId }
    );
    return records.map((r: { key: string }) => r.key);
  },
});

// Internal queries/mutations used by actions above

export const getSecretRecord = query({
  args: {
    agentId: v.id("agents"),
    key: v.string(),
  },
  handler: async (ctx, { agentId, key }) => {
    return await ctx.db
      .query("agentSecrets")
      .withIndex("by_agent_and_key", (q) =>
        q.eq("agentId", agentId).eq("key", key)
      )
      .first();
  },
});

export const listSecretKeys = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const records = await ctx.db
      .query("agentSecrets")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .collect();
    return records.map((r) => ({ key: r.key }));
  },
});

export const insertSecret = mutation({
  args: {
    agentId: v.id("agents"),
    key: v.string(),
    iv: v.string(),
    ciphertext: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentSecrets", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});

export const patchSecret = mutation({
  args: {
    id: v.id("agentSecrets"),
    iv: v.string(),
    ciphertext: v.string(),
  },
  handler: async (ctx, { id, iv, ciphertext }) => {
    await ctx.db.patch(id, { iv, ciphertext, updatedAt: Date.now() });
  },
});
