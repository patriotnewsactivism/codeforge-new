import { getAuthUserId } from "@convex-dev/auth/server";
import { internalQuery, internalAction, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const deleteAccount = mutation({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const authAccounts = await ctx.db
      .query("authAccounts")
      .filter(q => q.eq(q.field("userId"), userId))
      .collect();
    for (const account of authAccounts) {
      await ctx.db.delete(account._id);
    }

    const authSessions = await ctx.db
      .query("authSessions")
      .filter(q => q.eq(q.field("userId"), userId))
      .collect();
    for (const session of authSessions) {
      await ctx.db.delete(session._id);
    }

    await ctx.db.delete(userId);

    return { success: true };
  },
});

export const registerPushToken = mutation({
  args: {
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userPushTokens")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    if (!existing.find(t => t.token === args.token)) {
      await ctx.db.insert("userPushTokens", {
        userId,
        token: args.token,
        platform: args.platform,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const getPushTokens = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("userPushTokens")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .collect();
  },
});

// Internal-only: called by finishSession mutation via ctx.scheduler.
// Not exposed to clients — target user is always derived server-side.
export const notifyBuildComplete = internalAction({
  args: {
    userId: v.id("users"),
    projectName: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const tokens = await ctx.runQuery(internal.users.getPushTokens, {
      userId: args.userId,
    });
    if (!tokens.length) return;

    const messages = tokens.map(t => ({
      to: t.token,
      title: "Build Complete",
      body: `Your project "${args.projectName}" has finished building.`,
      sound: "default",
      data: {
        projectId: args.projectId,
        url: `codeforge-mobile://project/${args.projectId}`,
      },
    }));

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });
  },
});
