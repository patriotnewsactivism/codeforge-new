import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const PRESENCE_COLORS = [
  "#22d3ee", // cyan
  "#a78bfa", // violet
  "#f472b6", // pink
  "#fb923c", // orange
  "#4ade80", // green
  "#fbbf24", // amber
  "#60a5fa", // blue
  "#e879f9", // fuchsia
];

export const heartbeat = mutation({
  args: {
    projectId: v.id("projects"),
    activeFile: v.optional(v.string()),
    cursorLine: v.optional(v.number()),
    cursorColumn: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    const userName = user?.name ?? user?.email ?? "Anonymous";

    const existing = await ctx.db
      .query("collaborators")
      .withIndex("by_project_and_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", userId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        activeFile: args.activeFile,
        cursorLine: args.cursorLine,
        cursorColumn: args.cursorColumn,
        lastSeenAt: Date.now(),
        userName: String(userName),
      });
    } else {
      // Assign a color based on existing count
      const allCollabs = await ctx.db
        .query("collaborators")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
      const color =
        PRESENCE_COLORS[allCollabs.length % PRESENCE_COLORS.length];

      await ctx.db.insert("collaborators", {
        projectId: args.projectId,
        userId,
        userName: String(userName),
        activeFile: args.activeFile,
        cursorLine: args.cursorLine,
        cursorColumn: args.cursorColumn,
        lastSeenAt: Date.now(),
        color,
      });
    }
    return null;
  },
});

export const leave = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const existing = await ctx.db
      .query("collaborators")
      .withIndex("by_project_and_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", userId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const listActive = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("collaborators"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      userId: v.id("users"),
      userName: v.string(),
      activeFile: v.optional(v.string()),
      cursorLine: v.optional(v.number()),
      cursorColumn: v.optional(v.number()),
      lastSeenAt: v.number(),
      color: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const allCollabs = await ctx.db
      .query("collaborators")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    // Only return those seen in last 30 seconds
    const cutoff = Date.now() - 30_000;
    return allCollabs.filter((c) => c.lastSeenAt > cutoff);
  },
});

export const createInvite = mutation({
  args: { projectId: v.id("projects") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project || project.ownerId !== userId)
      throw new Error("Not authorized");

    const inviteCode = generateInviteCode();
    await ctx.db.insert("projectInvites", {
      projectId: args.projectId,
      invitedBy: userId,
      inviteCode,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });
    return inviteCode;
  },
});

export const joinByInvite = mutation({
  args: { inviteCode: v.string() },
  returns: v.union(v.id("projects"), v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const invite = await ctx.db
      .query("projectInvites")
      .withIndex("by_code", (q) => q.eq("inviteCode", args.inviteCode))
      .unique();

    if (!invite || invite.expiresAt < Date.now()) {
      return null;
    }

    return invite.projectId;
  },
});

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
