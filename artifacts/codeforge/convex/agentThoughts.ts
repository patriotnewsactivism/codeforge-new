import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── STREAMING THOUGHT PROCESS ───────────────────────────────────────────────
// Agents emit "thoughts" token by token into this table.
// The frontend subscribes via useQuery (Convex real-time) and renders them live.

export const listRecent = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
    buildSessionId: v.optional(v.id("buildSessions")),
  },
  handler: async (ctx, args) => {
    let thoughts = await ctx.db
      .query("agentThoughts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .take(args.limit ?? 100);

    if (args.buildSessionId) {
      thoughts = thoughts.filter((t) => t.buildSessionId === args.buildSessionId);
    }

    return thoughts;
  },
});

export const emit = mutation({
  args: {
    projectId: v.id("projects"),
    buildSessionId: v.optional(v.id("buildSessions")),
    agentId: v.string(),
    agentName: v.string(),
    type: v.union(
      v.literal("plan"),
      v.literal("analyze"),
      v.literal("code"),
      v.literal("debug"),
      v.literal("review"),
      v.literal("memory"),
      v.literal("search"),
      v.literal("commit"),
      v.literal("broadcast"),
      v.literal("done")
    ),
    content: v.string(),
    isStreaming: v.optional(v.boolean()),
  },
  returns: v.id("agentThoughts"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentThoughts", {
      projectId: args.projectId,
      buildSessionId: args.buildSessionId,
      agentId: args.agentId,
      agentName: args.agentName,
      type: args.type,
      content: args.content,
      isStreaming: args.isStreaming ?? false,
      timestamp: Date.now(),
    });
  },
});

export const clearForProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const thoughts = await ctx.db
      .query("agentThoughts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const t of thoughts) {
      await ctx.db.delete(t._id);
    }
  },
});
