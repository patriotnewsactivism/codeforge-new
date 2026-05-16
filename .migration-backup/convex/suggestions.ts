import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

declare const process: { env: Record<string, string | undefined> };

const VIKTOR_API_URL = process.env.VIKTOR_SPACES_API_URL!;
const PROJECT_NAME = process.env.VIKTOR_SPACES_PROJECT_NAME!;
const PROJECT_SECRET = process.env.VIKTOR_SPACES_PROJECT_SECRET!;

async function callAI(prompt: string, _maxTokens = 3000): Promise<string> {
  const res = await fetch(`${VIKTOR_API_URL}/api/viktor-spaces/tools/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_name: PROJECT_NAME,
      project_secret: PROJECT_SECRET,
      role: "quick_ai_search",
      arguments: { search_question: prompt },
    }),
  });
  if (!res.ok) throw new Error(`AI API error: HTTP ${res.status}`);
  const json = await res.json() as { success: boolean; error?: string; result?: { search_response: string } };
  if (!json.success) throw new Error(json.error ?? "AI call failed");
  return json.result?.search_response ?? "";
}

// ─── QUERIES ─────────────────────────────────────────────────────────────────

export const listByProject = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("suggestions"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      title: v.string(),
      description: v.string(),
      category: v.string(),
      priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
      status: v.union(
        v.literal("pending"),
        v.literal("implementing"),
        v.literal("done"),
        v.literal("dismissed")
      ),
      implementationPrompt: v.string(),
      generatedAt: v.number(),
      impactScore: v.optional(v.number()),
      autoApproved: v.optional(v.boolean()),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("suggestions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const listPending = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("suggestions"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      title: v.string(),
      description: v.string(),
      category: v.string(),
      priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
      status: v.union(
        v.literal("pending"),
        v.literal("implementing"),
        v.literal("done"),
        v.literal("dismissed")
      ),
      implementationPrompt: v.string(),
      generatedAt: v.number(),
      impactScore: v.optional(v.number()),
      autoApproved: v.optional(v.boolean()),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("suggestions")
      .withIndex("by_project_and_status", (q) =>
        q.eq("projectId", args.projectId).eq("status", "pending")
      )
      .order("desc")
      .collect();
  },
});

export const getAutonomousMode = query({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.object({
      _id: v.id("projectSettings"),
      projectId: v.id("projects"),
      autonomousMode: v.boolean(),
      autoIntervalMinutes: v.number(),
      lastAutoRunAt: v.optional(v.number()),
      projectSoul: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projectSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();
  },
});

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

export const updateStatus = mutation({
  args: {
    suggestionId: v.id("suggestions"),
    status: v.union(
      v.literal("pending"),
      v.literal("implementing"),
      v.literal("done"),
      v.literal("dismissed")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(args.suggestionId, { status: args.status });
    return null;
  },
});

export const addSuggestion = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    implementationPrompt: v.string(),
    impactScore: v.optional(v.number()),
    autoApproved: v.optional(v.boolean()),
  },
  returns: v.id("suggestions"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("suggestions", {
      ...args,
      status: "pending",
      generatedAt: Date.now(),
    });
  },
});

export const setAutonomousMode = mutation({
  args: {
    projectId: v.id("projects"),
    autonomousMode: v.boolean(),
    autoIntervalMinutes: v.optional(v.number()),
    projectSoul: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("projectSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        autonomousMode: args.autonomousMode,
        autoIntervalMinutes: args.autoIntervalMinutes ?? existing.autoIntervalMinutes,
        projectSoul: args.projectSoul ?? existing.projectSoul,
      });
    } else {
      await ctx.db.insert("projectSettings", {
        projectId: args.projectId,
        autonomousMode: args.autonomousMode,
        autoIntervalMinutes: args.autoIntervalMinutes ?? 15,
        projectSoul: args.projectSoul,
        lastAutoRunAt: undefined,
      });
    }
    return null;
  },
});

export const markAutoRunAt = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("projectSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { lastAutoRunAt: Date.now() });
    }
    return null;
  },
});

// ─── ACTIONS ─────────────────────────────────────────────────────────────────

// Proactive analysis: scan the project, generate smart ranked suggestions
// Never proposes something already done or dismissed
export const generateSuggestions = action({
  args: { projectId: v.id("projects") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const files = await ctx.runQuery(api.files.listByProject, { projectId: args.projectId });
    const existing = await ctx.runQuery(api.suggestions.listByProject, { projectId: args.projectId });
    const settings = await ctx.runQuery(api.suggestions.getAutonomousMode, { projectId: args.projectId });

    // Collect implemented + dismissed so we never re-suggest them
    const blocklist = new Set(
      existing
        .filter(s => s.status === "done" || s.status === "dismissed")
        .map(s => s.title.toLowerCase())
    );
    const pendingTitles = existing
      .filter((s: any) => s.status === "pending" || s.status === "implementing")
      .map((s: any) => s.title);

    const fileSummary = files
      .filter((f: any) => !f.isDirectory)
      .map((f: any) => `--- ${f.path} ---\n${f.content.slice(0, 800)}`)
      .join("\n\n");

    const soulSection = settings?.projectSoul
      ? `\nCORE PROJECT SOUL (NEVER VIOLATE):\n${settings.projectSoul}\n`
      : "";

    const prompt = `You are a senior product engineer analyzing a codebase to suggest the next best improvements.

${soulSection}
PROJECT FILES:
${fileSummary}

Already implemented (do NOT re-suggest): ${[...blocklist].join(", ") || "none"}
Already queued (do NOT re-suggest): ${pendingTitles.join(", ") || "none"}

Your job: suggest 4-6 high-impact improvements that would make this project genuinely better.
Rules:
- NEVER suggest removing or replacing core features — only additions and enhancements
- Rank by user value, not complexity
- Be specific — each implementationPrompt must be a complete instruction set an agent can execute
- Consider: UX polish, missing features, mobile experience, performance, error states, empty states, accessibility
- impactScore: 1-10 (10 = highest impact to users)

Return ONLY a JSON array (no markdown, no code fences):
[
  {
    "title": "Short feature name",
    "description": "One sentence describing what it does and why users will love it",
    "category": "ui|functionality|performance|ux|security|mobile",
    "priority": "high|medium|low",
    "impactScore": 8,
    "implementationPrompt": "Full, detailed instructions for an AI agent to implement this. Include which files to modify, what the behavior should be, edge cases to handle."
  }
]`;

    try {
      const text = await callAI(prompt, 4000);
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return 0;

      const suggestions = JSON.parse(jsonMatch[0]) as Array<{
        title: string;
        description: string;
        category: string;
        priority: string;
        impactScore?: number;
        implementationPrompt: string;
      }>;

      let added = 0;
      for (const s of suggestions) {
        if (blocklist.has(s.title.toLowerCase())) continue;
        const priority = (["high", "medium", "low"].includes(s.priority) ? s.priority : "medium") as "high" | "medium" | "low";
        const category = ["ui", "functionality", "performance", "ux", "security", "mobile"].includes(s.category)
          ? s.category : "functionality";
        await ctx.runMutation(api.suggestions.addSuggestion, {
          projectId: args.projectId,
          title: s.title,
          description: s.description,
          category,
          priority,
          implementationPrompt: s.implementationPrompt,
          impactScore: typeof s.impactScore === "number" ? s.impactScore : 5,
        });
        added++;
      }
      return added;
    } catch (e) {
      console.error("generateSuggestions failed:", e);
      return 0;
    }
  },
});

// One-click implement: marks as implementing then fires the full agent swarm
export const implementSuggestion = action({
  args: {
    projectId: v.id("projects"),
    suggestionId: v.id("suggestions"),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    // Get the suggestion
    const suggestion: any = await ctx.runQuery(api.suggestions.listByProject, {
      projectId: args.projectId,
    }).then(list => list.find((s: any) => s._id === args.suggestionId));

    if (!suggestion) throw new Error("Suggestion not found");

    // Mark as implementing
    await ctx.runMutation(api.suggestions.updateStatus, {
      suggestionId: args.suggestionId,
      status: "implementing",
    });

    // Get project soul (if set) and inject into agent prompt
    const settings = await ctx.runQuery(api.suggestions.getAutonomousMode, {
      projectId: args.projectId,
    });

    const soulGuard: string = settings?.projectSoul
      ? `\n\nCRITICAL: This project has a core soul/identity. Do NOT violate it:\n${settings.projectSoul}\n`
      : "";

    const enrichedPrompt = `${suggestion.implementationPrompt}${soulGuard}

IMPORTANT: This is an additive improvement. Do NOT remove or break any existing functionality. Only add to what's already there.`;

    try {
      const result: string = await ctx.runAction(api.agents.runMultiAgent, {
        projectId: args.projectId,
        prompt: enrichedPrompt,
      });

      await ctx.runMutation(api.suggestions.updateStatus, {
        suggestionId: args.suggestionId,
        status: "done",
      });

      return result;
    } catch (e) {
      await ctx.runMutation(api.suggestions.updateStatus, {
        suggestionId: args.suggestionId,
        status: "pending",
      });
      throw e;
    }
  },
});

// Autonomous build cycle: picks the top pending suggestion and builds it
// Called by a scheduled job when autonomousMode is ON
export const runAutonomousCycle = action({
  args: { projectId: v.id("projects") },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const settings = await ctx.runQuery(api.suggestions.getAutonomousMode, {
      projectId: args.projectId,
    });

    if (!settings?.autonomousMode) {
      return "Autonomous mode is off — skipping";
    }

    // 1. Generate fresh suggestions if we have fewer than 3 pending
    const pending = await ctx.runQuery(api.suggestions.listPending, {
      projectId: args.projectId,
    });

    if (pending.length < 3) {
      await ctx.runAction(api.suggestions.generateSuggestions, {
        projectId: args.projectId,
      });
    }

    // 2. Pick the top suggestion (highest impactScore, then highest priority)
    const freshPending: any[] = await ctx.runQuery(api.suggestions.listPending, {
      projectId: args.projectId,
    });

    if (freshPending.length === 0) {
      return "No pending suggestions to implement";
    }

    const priorityRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const top = freshPending.sort((a: any, b: any) => {
      const scoreA = (a.impactScore ?? 5) + (priorityRank[a.priority] ?? 1) * 2;
      const scoreB = (b.impactScore ?? 5) + (priorityRank[b.priority] ?? 1) * 2;
      return scoreB - scoreA;
    })[0];

    if (!top) return "No suggestion to implement";

    // 3. Build it
    await ctx.runMutation(api.suggestions.markAutoRunAt, {
      projectId: args.projectId,
    });

    const result: string = await ctx.runAction(api.suggestions.implementSuggestion, {
      projectId: args.projectId,
      suggestionId: top._id,
    });

    // 4. Immediately generate more suggestions to keep the queue full
    await ctx.runAction(api.suggestions.generateSuggestions, {
      projectId: args.projectId,
    });

    return `Built: "${top.title}" — ${result}`;
  },
});
