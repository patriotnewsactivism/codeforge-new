/**
 * limits.ts — Plan limits, usage gating, and cost tracking for CodeForge
 *
 * Free tier hooks users in. Paid tiers unlock exponential agent spawning.
 * Hard cost caps protect from runway compute bills if AI prices spike.
 */
import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

// ─── PLAN DEFINITIONS ────────────────────────────────────────────────────────
// These are the source of truth — UI and enforcement both read from here.

export type PlanKey = "free" | "weekly" | "monthly" | "lifetime";

export interface PlanLimits {
  aiRequestsPerDay: number;       // chat messages / AI calls per day
  missionsPerDay: number;         // full agent missions per day
  maxConcurrentAgents: number;    // agents running at once
  maxSpawnDepth: number;          // how deep agents can recursively spawn sub-agents
  maxSpawnsPerMission: number;    // total spawns in one mission
  maxProjects: number;
  hardCapUsdMonthly: number;      // max compute spend per month — you CANNOT lose money
  includedComputeUsd: number;     // how much compute is baked into the subscription price
  features: string[];
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: {
    aiRequestsPerDay: 15,
    missionsPerDay: 2,
    maxConcurrentAgents: 1,
    maxSpawnDepth: 1,       // can spawn 1 level deep — teaser of the power
    maxSpawnsPerMission: 3, // tiny swarm: planner + 2 workers
    maxProjects: 2,
    hardCapUsdMonthly: 0.25,    // cover with ads/loss-leader, $0.25 max
    includedComputeUsd: 0,
    features: [
      "15 AI requests / day",
      "2 agent missions / day",
      "1 agent at a time",
      "Spawn depth: 1 (tiny swarm preview)",
      "2 projects",
      "Community support",
    ],
  },
  weekly: {
    aiRequestsPerDay: 250,
    missionsPerDay: 20,
    maxConcurrentAgents: 5,
    maxSpawnDepth: 3,        // 3^3 = up to 27 agents in a mission
    maxSpawnsPerMission: 30,
    maxProjects: 15,
    hardCapUsdMonthly: 6.00, // $9.99 revenue, $6 max compute = guaranteed profit
    includedComputeUsd: 5.00,
    features: [
      "250 AI requests / day",
      "20 missions / day",
      "5 concurrent agents",
      "Spawn depth: 3 (up to 27 agents per mission)",
      "15 projects",
      "$5 compute / week included",
      "Priority support",
    ],
  },
  monthly: {
    aiRequestsPerDay: 600,
    missionsPerDay: 60,
    maxConcurrentAgents: 12,
    maxSpawnDepth: 4,        // 4^4 = up to 256 agents in a cascade
    maxSpawnsPerMission: 80,
    maxProjects: 30,
    hardCapUsdMonthly: 18.00, // $29.99 revenue, $18 max compute = >40% margin
    includedComputeUsd: 15.00,
    features: [
      "600 AI requests / day",
      "60 missions / day",
      "12 concurrent agents",
      "Spawn depth: 4 (up to 256 agents per mission!)",
      "30 projects",
      "$15 compute / month included",
      "Priority support",
      "Early feature access",
    ],
  },
  lifetime: {
    aiRequestsPerDay: 1500,
    missionsPerDay: 150,
    maxConcurrentAgents: 32,
    maxSpawnDepth: 5,        // 5^5 = up to 3125 agents — insane parallelism
    maxSpawnsPerMission: 250,
    maxProjects: 200,
    hardCapUsdMonthly: 50.00, // $420 one-time / 12 months = $35/mo revenue equiv, $50 cap with $420 buffer
    includedComputeUsd: 50.00,
    features: [
      "1,500 AI requests / day",
      "150 missions / day",
      "32 concurrent agents",
      "Spawn depth: 5 (up to 3,125 agents!!)",
      "200 projects",
      "$50 compute / month included",
      "VIP support & Discord",
      "All future features forever",
      "Founder badge",
    ],
  },
};

// ─── PERIOD HELPERS ──────────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function monthKey(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

// ─── QUERIES ─────────────────────────────────────────────────────────────────

export const getMyLimits = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { plan: "free" as PlanKey, limits: PLAN_LIMITS.free, usage: null, spend: null };

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const plan = (sub?.planKey as PlanKey) ?? "free";
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

    const usage = await ctx.db
      .query("userUsage")
      .withIndex("by_user_date", (q) => q.eq("userId", String(userId)).eq("date", todayKey()))
      .first();

    const spend = await ctx.db
      .query("userSpend")
      .withIndex("by_user_period", (q) => q.eq("userId", String(userId)).eq("periodKey", monthKey()))
      .first();

    return { plan, limits, usage: usage ?? null, spend: spend ?? null };
  },
});

export const checkCanRun = query({
  args: {
    action: v.union(
      v.literal("ai_request"),
      v.literal("start_mission"),
      v.literal("spawn_agent")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { allowed: false, reason: "Not authenticated" };

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const plan = (sub?.planKey as PlanKey) ?? "free";
    const limits = PLAN_LIMITS[plan];
    const today = todayKey();

    const usage = await ctx.db
      .query("userUsage")
      .withIndex("by_user_date", (q) => q.eq("userId", String(userId)).eq("date", today))
      .first();

    const spend = await ctx.db
      .query("userSpend")
      .withIndex("by_user_period", (q) => q.eq("userId", String(userId)).eq("periodKey", monthKey()))
      .first();

    // Hard cost cap check
    if (spend && spend.totalCostUsd >= spend.capUsd) {
      return {
        allowed: false,
        reason: `Monthly compute cap ($${spend.capUsd.toFixed(2)}) reached. Resets next month.`,
        cappedAt: spend.cappedAt,
        upgradeHint: plan === "free" ? "Upgrade to unlock more compute." : undefined,
      };
    }

    switch (args.action) {
      case "ai_request":
        if ((usage?.aiRequests ?? 0) >= limits.aiRequestsPerDay) {
          return {
            allowed: false,
            reason: `Daily AI request limit reached (${limits.aiRequestsPerDay}/day on ${plan} plan). Resets midnight UTC.`,
            upgradeHint: plan !== "lifetime" ? "Upgrade for more requests per day." : undefined,
          };
        }
        break;
      case "start_mission":
        if ((usage?.missions ?? 0) >= limits.missionsPerDay) {
          return {
            allowed: false,
            reason: `Daily mission limit reached (${limits.missionsPerDay}/day on ${plan} plan). Resets midnight UTC.`,
            upgradeHint: plan !== "lifetime" ? "Upgrade to run more missions." : undefined,
          };
        }
        break;
      case "spawn_agent":
        // spawn_agent checks are inline in engine.ts using plan limits
        break;
    }

    return { allowed: true };
  },
});

// ─── MUTATIONS ───────────────────────────────────────────────────────────────

export const trackUsage = mutation({
  args: {
    userId: v.string(),
    action: v.union(
      v.literal("ai_request"),
      v.literal("start_mission"),
      v.literal("spawn_agent")
    ),
    costUsd: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const today = todayKey();

    // Upsert daily usage
    const existing = await ctx.db
      .query("userUsage")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", today))
      .first();

    if (existing) {
      const patch: Record<string, number> = {};
      if (args.action === "ai_request") patch.aiRequests = existing.aiRequests + 1;
      if (args.action === "start_mission") patch.missions = existing.missions + 1;
      if (args.action === "spawn_agent") patch.agentsSpawned = existing.agentsSpawned + 1;
      if (args.costUsd) patch.computeCostUsd = existing.computeCostUsd + args.costUsd;
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("userUsage", {
        userId: args.userId,
        date: today,
        aiRequests: args.action === "ai_request" ? 1 : 0,
        missions: args.action === "start_mission" ? 1 : 0,
        agentsSpawned: args.action === "spawn_agent" ? 1 : 0,
        computeCostUsd: args.costUsd ?? 0,
        periodStart: Date.now(),
      });
    }

    // Upsert monthly spend
    if (args.costUsd && args.costUsd > 0) {
      const period = monthKey();
      const sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", args.userId as any))
        .first();
      const plan = (sub?.planKey as PlanKey) ?? "free";
      const cap = PLAN_LIMITS[plan].hardCapUsdMonthly;

      const spendRec = await ctx.db
        .query("userSpend")
        .withIndex("by_user_period", (q) => q.eq("userId", args.userId).eq("periodKey", period))
        .first();

      if (spendRec) {
        const newTotal = spendRec.totalCostUsd + args.costUsd;
        await ctx.db.patch(spendRec._id, {
          totalCostUsd: newTotal,
          cappedAt: newTotal >= cap && !spendRec.cappedAt ? Date.now() : spendRec.cappedAt,
        });
      } else {
        await ctx.db.insert("userSpend", {
          userId: args.userId,
          periodKey: period,
          totalCostUsd: args.costUsd,
          capUsd: cap,
          plan,
        });
      }
    }

    return null;
  },
});

// ─── ACTION: get plan limits for use in other actions ────────────────────────

export const getUserPlanLimits = action({
  args: { userId: v.string() },
  returns: v.object({
    plan: v.string(),
    maxSpawnDepth: v.number(),
    maxSpawnsPerMission: v.number(),
    maxConcurrentAgents: v.number(),
    hardCapUsdMonthly: v.number(),
    cappedOut: v.boolean(),
  }),
  handler: async (ctx, args): Promise<{ plan: string; maxSpawnDepth: number; maxSpawnsPerMission: number; maxConcurrentAgents: number; hardCapUsdMonthly: number; cappedOut: boolean }> => {
    const sub = await ctx.runQuery(api.limits.getUserSub, { userId: args.userId });
    const plan = (sub?.planKey as PlanKey) ?? "free";
    const limits = PLAN_LIMITS[plan];

    const period = new Date().toISOString().slice(0, 7);
    const spend = await ctx.runQuery(api.limits.getSpend, {
      userId: args.userId,
      periodKey: period,
    });

    const cappedOut = spend ? spend.totalCostUsd >= spend.capUsd : false;

    return {
      plan,
      maxSpawnDepth: limits.maxSpawnDepth,
      maxSpawnsPerMission: limits.maxSpawnsPerMission,
      maxConcurrentAgents: limits.maxConcurrentAgents,
      hardCapUsdMonthly: limits.hardCapUsdMonthly,
      cappedOut,
    };
  },
});

export const getUserSub = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId as any))
      .first();
  },
});

export const getSpend = query({
  args: { userId: v.string(), periodKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userSpend")
      .withIndex("by_user_period", (q) =>
        q.eq("userId", args.userId).eq("periodKey", args.periodKey)
      )
      .first();
  },
});
