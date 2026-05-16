import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

declare const process: { env: Record<string, string | undefined> };

const VIKTOR_API_URL = process.env.VIKTOR_SPACES_API_URL!;
const PROJECT_NAME = process.env.VIKTOR_SPACES_PROJECT_NAME!;
const PROJECT_SECRET = process.env.VIKTOR_SPACES_PROJECT_SECRET!;

async function callAI(prompt: string): Promise<string> {
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

export const listMemories = query({
  args: {
    projectId: v.id("projects"),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let memories = await ctx.db
      .query("agentMemories")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    if (args.category) {
      memories = memories.filter((m) => m.category === args.category);
    }

    // Sort by effective importance (importance * decayFactor) descending
    memories.sort((a, b) => (b.importance * b.decayFactor) - (a.importance * a.decayFactor));

    return memories.slice(0, args.limit ?? 50);
  },
});

export const listRetrospectives = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("taskRetrospectives")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(20);
  },
});

export const listAgentMessages = query({
  args: {
    projectId: v.id("projects"),
    buildSessionId: v.optional(v.id("buildSessions")),
  },
  handler: async (ctx, args) => {
    if (args.buildSessionId) {
      return await ctx.db
        .query("agentMessages")
        .withIndex("by_build_session", (q) =>
          q.eq("buildSessionId", args.buildSessionId)
        )
        .order("desc")
        .take(100);
    }
    return await ctx.db
      .query("agentMessages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(100);
  },
});

export const getMemoryStats = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const memories = await ctx.db
      .query("agentMemories")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const retros = await ctx.db
      .query("taskRetrospectives")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const avgScore = retros.length > 0
      ? retros.reduce((sum, r) => sum + r.qualityScore, 0) / retros.length
      : 0;

    const byCategory: Record<string, number> = {};
    for (const m of memories) {
      byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
    }

    return {
      totalMemories: memories.length,
      totalRetrospectives: retros.length,
      avgQualityScore: Math.round(avgScore * 10) / 10,
      byCategory,
    };
  },
});

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

export const addMemory = mutation({
  args: {
    projectId: v.id("projects"),
    category: v.union(
      v.literal("pattern"),
      v.literal("anti_pattern"),
      v.literal("preference"),
      v.literal("architecture"),
      v.literal("dependency"),
      v.literal("bugfix"),
      v.literal("convention"),
      v.literal("tool"),
      v.literal("insight")
    ),
    content: v.string(),
    importance: v.number(),
    sourceTaskId: v.optional(v.id("agentTasks")),
    sourceRetroId: v.optional(v.id("taskRetrospectives")),
  },
  returns: v.id("agentMemories"),
  handler: async (ctx, args) => {
    // Duplicate detection: check if very similar memory already exists
    const existing = await ctx.db
      .query("agentMemories")
      .withIndex("by_project_and_category", (q) =>
        q.eq("projectId", args.projectId).eq("category", args.category)
      )
      .collect();

    // Simple duplicate check: if content is >80% similar, boost importance instead
    const contentLower = args.content.toLowerCase();
    const duplicate = existing.find((m) => {
      const overlap = contentLower
        .split(" ")
        .filter((w) => w.length > 4 && m.content.toLowerCase().includes(w)).length;
      const words = contentLower.split(" ").filter((w) => w.length > 4).length;
      return words > 0 && overlap / words > 0.6;
    });

    if (duplicate) {
      // Boost existing memory instead of duplicating
      await ctx.db.patch(duplicate._id, {
        importance: Math.min(1.0, duplicate.importance + 0.1),
        usageCount: duplicate.usageCount + 1,
        lastUsedAt: Date.now(),
        decayFactor: Math.min(1.0, duplicate.decayFactor + 0.05),
      });
      return duplicate._id;
    }

    return await ctx.db.insert("agentMemories", {
      projectId: args.projectId,
      category: args.category,
      content: args.content,
      importance: Math.min(1.0, Math.max(0.0, args.importance)),
      usageCount: 0,
      lastUsedAt: Date.now(),
      sourceTaskId: args.sourceTaskId,
      sourceRetroId: args.sourceRetroId,
      decayFactor: 1.0,
    });
  },
});

export const markMemoryUsed = mutation({
  args: { memoryId: v.id("agentMemories") },
  handler: async (ctx, args) => {
    const mem = await ctx.db.get(args.memoryId);
    if (!mem) return;
    await ctx.db.patch(args.memoryId, {
      usageCount: mem.usageCount + 1,
      lastUsedAt: Date.now(),
      // Each use slightly boosts importance
      importance: Math.min(1.0, mem.importance + 0.02),
    });
  },
});

export const applyMemoryDecay = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const memories = await ctx.db
      .query("agentMemories")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const now = Date.now();

    for (const mem of memories) {
      const ageDays = (now - mem.lastUsedAt) / (1000 * 60 * 60 * 24);
      if (ageDays > 7) {
        // Memories unused for > 1 week decay by 2% per day
        const decayAmount = Math.min(0.5, (ageDays - 7) * 0.02);
        const newDecay = Math.max(0.1, mem.decayFactor - decayAmount);
        await ctx.db.patch(mem._id, { decayFactor: newDecay });
      }
    }
  },
});

export const postAgentMessage = mutation({
  args: {
    projectId: v.id("projects"),
    buildSessionId: v.optional(v.id("buildSessions")),
    fromAgentId: v.string(),
    fromAgentName: v.string(),
    fromAgentIcon: v.string(),
    toAgentId: v.optional(v.string()),
    toAgentName: v.optional(v.string()),
    messageType: v.union(
      v.literal("warning"),
      v.literal("context"),
      v.literal("request"),
      v.literal("finding"),
      v.literal("blocker"),
      v.literal("resolved")
    ),
    content: v.string(),
    relatedFiles: v.optional(v.array(v.string())),
  },
  returns: v.id("agentMessages"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentMessages", {
      ...args,
      timestamp: Date.now(),
      acknowledged: false,
    });
  },
});

// ─── ACTIONS ─────────────────────────────────────────────────────────────────

// Get the top N memories to inject into an agent's prompt
export const getMemoriesForPrompt = action({
  args: {
    projectId: v.id("projects"),
    topN: v.optional(v.number()),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const topN = args.topN ?? 15;
    const memories = await ctx.runQuery(api.memory.listMemories, {
      projectId: args.projectId,
      limit: topN,
    });

    if (memories.length === 0) return "";

    // Mark all retrieved memories as used
    for (const mem of memories) {
      await ctx.runMutation(api.memory.markMemoryUsed, { memoryId: mem._id });
    }

    const grouped: Record<string, typeof memories> = {};
    for (const mem of memories) {
      if (!grouped[mem.category]) grouped[mem.category] = [];
      grouped[mem.category].push(mem);
    }

    const lines: string[] = [
      "=== AGENT MEMORY (learned from past tasks) ===",
    ];

    for (const [category, mems] of Object.entries(grouped)) {
      lines.push(`\n[${category.toUpperCase().replace("_", " ")}]`);
      for (const m of mems) {
        const strength = m.importance * m.decayFactor;
        const bar = strength > 0.7 ? "●●●" : strength > 0.4 ? "●●○" : "●○○";
        lines.push(`  ${bar} ${m.content}`);
      }
    }

    lines.push("\n=== END MEMORY ===\n");
    return lines.join("\n");
  },
});

// Run a retrospective after a completed agent task
export const runRetrospective = action({
  args: {
    projectId: v.id("projects"),
    buildSessionId: v.optional(v.id("buildSessions")),
    triggerTaskId: v.optional(v.id("agentTasks")),
    agentResults: v.array(v.object({
      agentId: v.string(),
      agentName: v.string(),
      task: v.string(),
      status: v.string(),
      result: v.optional(v.string()),
      filesChanged: v.optional(v.array(v.string())),
    })),
    originalPrompt: v.string(),
  },
  returns: v.id("taskRetrospectives"),
  handler: async (ctx, args): Promise<Id<"taskRetrospectives">> => {
    const agentsInvolved = args.agentResults.map((a) => a.agentId);
    const successCount = args.agentResults.filter((a) => a.status === "done").length;
    const errorCount = args.agentResults.filter((a) => a.status === "error").length;

    const retroPrompt = `You are CodeForge's Retrospective Agent. Analyze this completed agent task.

ORIGINAL REQUEST: "${args.originalPrompt}"

AGENT RESULTS:
${args.agentResults.map((a) => `
Agent: ${a.agentName} (${a.agentId})
Task: ${a.task}
Status: ${a.status}
Result: ${a.result ?? "none"}
Files Changed: ${(a.filesChanged ?? []).join(", ") || "none"}
`).join("\n---\n")}

Summary: ${successCount}/${args.agentResults.length} agents succeeded, ${errorCount} failed.

Analyze this run and return ONLY valid JSON (no markdown):
{
  "qualityScore": <1-10 integer>,
  "whatWorked": ["specific thing that worked", "..."],
  "whatFailed": ["specific thing that failed or could be better", "..."],
  "improvements": ["concrete improvement for next time", "..."],
  "memories": [
    {
      "category": "pattern|anti_pattern|preference|architecture|dependency|bugfix|convention|tool|insight",
      "content": "specific, actionable memory text (1-2 sentences max)",
      "importance": <0.1-1.0 float>
    }
  ]
}

Rules:
- qualityScore: 9-10 = flawless, 7-8 = good with minor issues, 5-6 = acceptable, 1-4 = significant problems
- whatWorked/whatFailed: 2-5 items each, be specific
- improvements: 2-4 concrete action items
- memories: 2-6 memories worth keeping for future tasks, be specific and actionable`;

    const raw = await callAI(retroPrompt);

    let parsed: {
      qualityScore: number;
      whatWorked: string[];
      whatFailed: string[];
      improvements: string[];
      memories: Array<{ category: string; content: string; importance: number }>;
    };

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] ?? "{}");
    } catch {
      parsed = {
        qualityScore: 5,
        whatWorked: ["Task completed"],
        whatFailed: ["Could not parse detailed analysis"],
        improvements: ["Improve agent output format"],
        memories: [],
      };
    }

    // Create memory records from the retrospective
    const memoryIds: Id<"agentMemories">[] = [];

    // We need the retroId first — insert a placeholder, then update with memoryIds
    const retroId = await ctx.runMutation(api.memory.createRetrospective, {
      projectId: args.projectId,
      triggerTaskId: args.triggerTaskId,
      buildSessionId: args.buildSessionId,
      qualityScore: Math.max(1, Math.min(10, parsed.qualityScore ?? 5)),
      whatWorked: parsed.whatWorked ?? [],
      whatFailed: parsed.whatFailed ?? [],
      improvements: parsed.improvements ?? [],
      memoriesCreated: [],
      rawAnalysis: raw,
      agentsInvolved,
    });

    // Now create memories referencing this retro
    for (const mem of (parsed.memories ?? [])) {
      const validCategories = [
        "pattern", "anti_pattern", "preference", "architecture",
        "dependency", "bugfix", "convention", "tool", "insight",
      ];
      const category = validCategories.includes(mem.category) ? mem.category : "insight";
      const memId = await ctx.runMutation(api.memory.addMemory, {
        projectId: args.projectId,
        category: category as "pattern" | "anti_pattern" | "preference" | "architecture" | "dependency" | "bugfix" | "convention" | "tool" | "insight",
        content: mem.content,
        importance: Math.max(0.1, Math.min(1.0, mem.importance ?? 0.5)),
        sourceTaskId: args.triggerTaskId,
        sourceRetroId: retroId,
      });
      memoryIds.push(memId);
    }

    // Patch the retro with actual memory IDs
    await ctx.runMutation(api.memory.patchRetrospectiveMemories, {
      retroId,
      memoriesCreated: memoryIds,
    });

    return retroId;
  },
});

export const createRetrospective = mutation({
  args: {
    projectId: v.id("projects"),
    triggerTaskId: v.optional(v.id("agentTasks")),
    buildSessionId: v.optional(v.id("buildSessions")),
    qualityScore: v.number(),
    whatWorked: v.array(v.string()),
    whatFailed: v.array(v.string()),
    improvements: v.array(v.string()),
    memoriesCreated: v.array(v.id("agentMemories")),
    rawAnalysis: v.string(),
    agentsInvolved: v.array(v.string()),
  },
  returns: v.id("taskRetrospectives"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("taskRetrospectives", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const patchRetrospectiveMemories = mutation({
  args: {
    retroId: v.id("taskRetrospectives"),
    memoriesCreated: v.array(v.id("agentMemories")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.retroId, { memoriesCreated: args.memoriesCreated });
  },
});

export const deleteMemory = mutation({
  args: { memoryId: v.id("agentMemories") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.memoryId);
  },
});
