/**
 * MISSIONS — Maps to v2's buildSessions (the equivalent concept)
 */
import { v } from "convex/values";
import { query } from "./_generated/server";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("buildSessions")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(20);
  },
});

export const get = query({
  args: { missionId: v.id("buildSessions") },
  handler: async (ctx, { missionId }) => {
    return await ctx.db.get(missionId);
  },
});
