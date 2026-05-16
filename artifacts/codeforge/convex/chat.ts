import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

declare const process: { env: Record<string, string | undefined> };

const VIKTOR_API_URL = process.env.VIKTOR_SPACES_API_URL!;
const PROJECT_NAME = process.env.VIKTOR_SPACES_PROJECT_NAME!;
const PROJECT_SECRET = process.env.VIKTOR_SPACES_PROJECT_SECRET!;

// Model configurations with pricing (per 1M tokens)
const MODELS: Record<
  string,
  { name: string; inputCostPer1M: number; outputCostPer1M: number }
> = {
  "deepseek-v4-flash": {
    name: "DeepSeek V4 Flash",
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
  },
  "deepseek-v3.2": {
    name: "DeepSeek V3.2",
    inputCostPer1M: 0.27,
    outputCostPer1M: 1.1,
  },
  "grok-4.1-fast": {
    name: "Grok 4.1 Fast",
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
  "gpt-5-mini": {
    name: "GPT-5 Mini",
    inputCostPer1M: 1.5,
    outputCostPer1M: 6.0,
  },
};

// Cost estimation (rough: ~4 chars per token)
function estimateCost(
  text: string,
  model: string,
  isOutput: boolean
): { tokens: number; cost: number } {
  const tokens = Math.ceil(text.length / 4);
  const config = MODELS[model] ?? MODELS["deepseek-v4-flash"];
  const costPer1M = isOutput ? config.outputCostPer1M : config.inputCostPer1M;
  const cost = (tokens / 1_000_000) * costPer1M;
  return { tokens, cost };
}


// ─── AI CALL HELPER ───────────────────────────────────────────────────────────
async function callViktorAI(
  userMessage: string,
  context?: string,
  _model?: string   // kept for API compat — Viktor uses quick_ai_search role
): Promise<string> {
  const prompt = context
    ? `CONTEXT:\n${context.slice(0, 4000)}\n\nUSER: ${userMessage}`
    : userMessage;

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
  if (!res.ok) throw new Error(`Viktor API ${res.status}: ${await res.text()}`);
  const json = await res.json() as { success: boolean; error?: string; result?: { search_response: string } };
  if (!json.success) throw new Error(json.error ?? "AI call failed");
  return json.result?.search_response ?? "";
}

// ─── Session Management ────────────────────────────────────────

export const getOrCreateSession = mutation({
  args: { projectId: v.id("projects"), model: v.optional(v.string()) },
  returns: v.id("chatSessions"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Find existing active (non-archived) session
    const existing = await ctx.db
      .query("chatSessions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const userSession = existing.find((s) => s.userId === userId && !s.isArchived);
    if (userSession) return userSession._id;

    return await ctx.db.insert("chatSessions", {
      projectId: args.projectId,
      userId,
      model: args.model ?? "deepseek-v4-flash",
      totalTokensUsed: 0,
      totalCost: 0,
      createdAt: Date.now(),
    });
  },
});

export const createSession = mutation({
  args: { projectId: v.id("projects"), title: v.optional(v.string()), model: v.optional(v.string()) },
  returns: v.id("chatSessions"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("chatSessions", {
      projectId: args.projectId,
      userId,
      title: args.title ?? "New Chat",
      model: args.model ?? "deepseek-v4-flash",
      totalTokensUsed: 0,
      totalCost: 0,
      createdAt: Date.now(),
    });
  },
});

export const listSessions = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return sessions
      .filter((s) => s.userId === userId && !s.isArchived)
      .sort((a, b) => (b.createdAt ?? b._creationTime) - (a.createdAt ?? a._creationTime));
  },
});

export const renameSession = mutation({
  args: { sessionId: v.id("chatSessions"), title: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) throw new Error("Not your session");
    await ctx.db.patch(args.sessionId, { title: args.title });
    return null;
  },
});

export const deleteSession = mutation({
  args: { sessionId: v.id("chatSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) throw new Error("Not your session");

    // Delete all messages in this session
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    await ctx.db.delete(args.sessionId);
    return null;
  },
});

export const archiveSession = mutation({
  args: { sessionId: v.id("chatSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) throw new Error("Not your session");
    await ctx.db.patch(args.sessionId, { isArchived: true });
    return null;
  },
});

export const getSession = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

export const updateModel = mutation({
  args: { sessionId: v.id("chatSessions"), model: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(args.sessionId, { model: args.model });
    return null;
  },
});

// ─── Messages ──────────────────────────────────────────────────

export const listMessages = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const addMessage = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    projectId: v.id("projects"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
    content: v.string(),
    model: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    cost: v.optional(v.number()),
    isError: v.optional(v.boolean()),
    userId: v.optional(v.id("users")),
    fileContexts: v.optional(v.array(v.object({
      path: v.string(),
      content: v.string(),
    }))),
  },
  returns: v.id("chatMessages"),
  handler: async (ctx, args) => {
    // Update session totals if we have cost info
    if (args.tokensUsed || args.cost) {
      const session = await ctx.db.get(args.sessionId);
      if (session) {
        await ctx.db.patch(args.sessionId, {
          totalTokensUsed:
            session.totalTokensUsed + (args.tokensUsed ?? 0),
          totalCost: session.totalCost + (args.cost ?? 0),
        });
      }
    }
    return await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      projectId: args.projectId,
      role: args.role,
      content: args.content,
      model: args.model,
      tokensUsed: args.tokensUsed,
      cost: args.cost,
      isError: args.isError,
      userId: args.userId,
      fileContexts: args.fileContexts,
    });
  },
});

// ─── AI Chat Action ────────────────────────────────────────────

export const sendMessage = action({
  args: {
    sessionId: v.id("chatSessions"),
    projectId: v.id("projects"),
    content: v.string(),
    model: v.string(),
    fileContext: v.optional(v.string()),
    fileContexts: v.optional(v.array(v.object({
      path: v.string(),
      content: v.string(),
    }))),
    userId: v.id("users"),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    let combinedContext = "";
    if (args.fileContexts && args.fileContexts.length > 0) {
      combinedContext = args.fileContexts.map(f => `--- ${f.path} ---\n${f.content}`).join("\n\n");
    } else if (args.fileContext) {
      combinedContext = args.fileContext;
    }

    // ── Usage gate ─────────────────────────────────────────────────────────
    try {
      const gate = await ctx.runQuery(api.limits.checkCanRun, { action: "ai_request" });
      if (!gate.allowed) {
        const hint = (gate as any).upgradeHint ?? "";
        throw new Error(`\u{1F6AB} ${gate.reason}${hint ? " " + hint : ""}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("\u{1F6AB}")) throw e;
    }

    // Save user message
    await ctx.runMutation(api.chat.addMessage, {
      sessionId: args.sessionId,
      projectId: args.projectId,
      role: "user",
      content: args.content,
      userId: args.userId,
      fileContexts: args.fileContexts,
    });

    // ── SMART ROUTING ──────────────────────────────────────────────────────────
    // Code-action keywords → dispatch to engine.runMission (full agent loop)
    // Questions/explanations → direct AI response (fast, cheap)
    const isCodeRequest = /\b(build|create|add|make|implement|fix|refactor|update|write|generate|change|edit|delete|remove|style|design|migrate|rename|move|replace|convert|upgrade|optimize|improve|debug|deploy)\b/i.test(args.content);

    // ── PATH A: Direct AI (questions, explanations, reviews) ──────────────────
    if (!isCodeRequest) {
      const modelOrder = [args.model, "deepseek-v4-flash"].filter((m, i, arr) => arr.indexOf(m) === i);
      for (const model of modelOrder) {
        try {
          const result = await callViktorAI(args.content, combinedContext || undefined, model);
          const inputEst = estimateCost(args.content + combinedContext, model, false);
          const outputEst = estimateCost(result, model, true);
          await ctx.runMutation(api.chat.addMessage, {
            sessionId: args.sessionId,
            projectId: args.projectId,
            role: "assistant",
            content: result,
            model: MODELS[model]?.name ?? model,
            tokensUsed: inputEst.tokens + outputEst.tokens,
            cost: inputEst.cost + outputEst.cost,
          });
          return result;
        } catch (e) {
          console.log(`Direct AI model ${model} failed:`, e);
          continue;
        }
      }
    }

    // ── PATH B: Engine mission (code changes) ─────────────────────────────────
    // Notify chat that agents are spawning
    await ctx.runMutation(api.chat.addMessage, {
      sessionId: args.sessionId,
      projectId: args.projectId,
      role: "assistant",
      content: "🤖 Launching agent swarm... Watch the Agents panel for live progress.",
    });

    try {
      const result = await ctx.runAction(api.engine.runMission, {
        projectId: args.projectId,
        prompt: args.content,
        sessionId: args.sessionId,
      });

      // Update that last message with the real result
      await ctx.runMutation(api.chat.addMessage, {
        sessionId: args.sessionId,
        projectId: args.projectId,
        role: "assistant",
        content: `✅ Done!\n\n${result}`,
      });

      return result;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(api.chat.addMessage, {
        sessionId: args.sessionId,
        projectId: args.projectId,
        role: "assistant",
        content: `❌ Mission failed: ${errMsg}`,
        isError: true,
      });
      return errMsg;
    }
  },
});
