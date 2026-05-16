/**
 * CODEFORGE v2 — SHAREABLE PREVIEWS (UPGRADE #3)
 * Public URL generation for project previews
 */
import { v } from "convex/values";
import { action, mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 12; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

export const getShareLink = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("projectShares" as any)
      .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .first();
  },
});

export const createShareLink = action({
  args: {
    projectId: v.id("projects"),
    expiry: v.union(v.literal("24h"), v.literal("7d"), v.literal("never")),
    password: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, expiry, password }) => {
    const token = generateToken();
    const expiresAt = expiry === "24h" ? Date.now() + 86400000
      : expiry === "7d" ? Date.now() + 7 * 86400000
      : null;

    await ctx.runMutation(internal.previews.upsertShare, {
      projectId, token, expiry,
      expiresAt: expiresAt || undefined,
      hasPassword: !!password,
      passwordHash: password || undefined,
    });

    return { token, url: "https://preview.codeforge.dev/p/" + token };
  },
});

export const upsertShare = internalMutation({
  args: {
    projectId: v.id("projects"),
    token: v.string(),
    expiry: v.string(),
    expiresAt: v.optional(v.number()),
    hasPassword: v.boolean(),
    passwordHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("projectShares" as any)
      .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, isActive: true, viewCount: 0, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("projectShares" as any, {
        ...args, isActive: true, viewCount: 0, createdAt: Date.now(), updatedAt: Date.now(),
      });
    }
  },
});

export const revokeShareLink = mutation({
  args: { shareId: v.any() },
  handler: async (ctx, { shareId }) => {
    await ctx.db.patch(shareId, { isActive: false });
  },
});

// ── Used by HTTP preview endpoint ───────────────────────────────
export const getShareByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return await ctx.db
      .query("projectShares" as any)
      .withIndex("by_token", (q: any) => q.eq("token", token))
      .first();
  },
});

export const incrementViewCount = mutation({
  args: { shareId: v.any() },
  handler: async (ctx, { shareId }) => {
    const share = await ctx.db.get(shareId);
    if (share) {
      await ctx.db.patch(shareId, {
        viewCount: ((share as any).viewCount || 0) + 1,
        lastViewedAt: Date.now(),
      });
    }
  },
});
