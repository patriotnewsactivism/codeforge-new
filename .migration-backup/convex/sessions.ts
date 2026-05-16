import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const get = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db.get(sessionId);
  },
});

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("sessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("isActive", true)
      )
      .first();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    model: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    // Deactivate other sessions
    const active = await ctx.db
      .query("sessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("isActive", true)
      )
      .collect();
    for (const s of active) {
      await ctx.db.patch(s._id, { isActive: false });
    }
    return await ctx.db.insert("sessions", {
      userId,
      projectId: args.projectId,
      name: args.name,
      model: args.model,
      totalCost: 0,
      isActive: true,
    });
  },
});

export const updateModel = mutation({
  args: {
    sessionId: v.id("sessions"),
    model: v.string(),
  },
  handler: async (ctx, { sessionId, model }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(sessionId, { model });
  },
});

export const addCost = mutation({
  args: {
    sessionId: v.id("sessions"),
    cost: v.number(),
  },
  handler: async (ctx, { sessionId, cost }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    await ctx.db.patch(sessionId, {
      totalCost: (session.totalCost || 0) + cost,
    });
  },
});

// ── Real presence: sessions active on a project in the last N ms ─
export const listActiveByProject = query({
  args: {
    projectId: v.id("projects"),
    sinceMs: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, sinceMs }) => {
    // cutoff not currently used
    void sinceMs;
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Enrich with user info
    const enriched = await Promise.all(
      sessions.slice(0, 12).map(async (s) => {
        const user = await ctx.db.get(s.userId);
        return {
          ...s,
          displayName: user ? (user as any).name || (user as any).email?.split("@")[0] || "User" : "User",
        };
      })
    );
    return enriched;
  },
});
