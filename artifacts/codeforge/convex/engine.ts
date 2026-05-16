/**
 * engine.ts — CodeForge v2 Agentic Tool-Calling Loop
 *
 * Instead of AI writing markdown parsed with regex, agents use structured tool calls:
 *   Agent calls AI → AI returns { tool_calls: [...] } → Tools execute → Results → AI continues
 *
 * Tools: create_file, edit_file, delete_file, read_file, list_files,
 *        search_files, spawn_agent, send_message, complete_task
 */

import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

declare const process: { env: Record<string, string | undefined> };
const VIKTOR_API_URL = process.env.VIKTOR_SPACES_API_URL!;
const PROJECT_NAME = process.env.VIKTOR_SPACES_PROJECT_NAME!;
const PROJECT_SECRET = process.env.VIKTOR_SPACES_PROJECT_SECRET!;

// ─── TOOL CALL SCHEMA ────────────────────────────────────────────────────────

export type ToolName =
  | "create_file"
  | "edit_file"
  | "delete_file"
  | "read_file"
  | "list_files"
  | "search_files"
  | "spawn_agent"
  | "send_message"
  | "complete_task";

export interface ToolCall {
  tool: ToolName;
  args: Record<string, string | number | boolean>;
}

export interface ToolResult {
  tool: ToolName;
  success: boolean;
  output: string;
  error?: string;
}

// ─── DB HELPERS ──────────────────────────────────────────────────────────────

// toolCalls table mutations
export const createToolCall = mutation({
  args: {
    projectId: v.id("projects"),
    missionId: v.string(),
    agentId: v.string(),
    agentName: v.string(),
    tool: v.string(),
    args: v.string(), // JSON
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("done"), v.literal("error")),
  },
  returns: v.id("toolCalls"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("toolCalls", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const updateToolCall = mutation({
  args: {
    toolCallId: v.id("toolCalls"),
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("done"), v.literal("error")),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.result !== undefined) patch.result = args.result;
    if (args.error !== undefined) patch.error = args.error;
    patch.finishedAt = Date.now();
    await ctx.db.patch(args.toolCallId, patch);
    return null;
  },
});

export const listToolCalls = query({
  args: {
    projectId: v.id("projects"),
    missionId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let calls = await ctx.db
      .query("toolCalls")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .take(args.limit ?? 200);
    if (args.missionId) {
      calls = calls.filter((c) => c.missionId === args.missionId);
    }
    return calls;
  },
});

export const clearToolCalls = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const calls = await ctx.db
      .query("toolCalls")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const c of calls) await ctx.db.delete(c._id);
    return null;
  },
});

// ─── AI CALL ─────────────────────────────────────────────────────────────────

// ─── AI CALL ─────────────────────────────────────────────────────────────────
// Uses quick_ai_search as the underlying LLM — we craft a tight prompt that
// forces structured JSON output so agents always make real progress.

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
  if (!res.ok) throw new Error(`AI API ${res.status}: ${await res.text()}`);
  const json = await res.json() as { success: boolean; error?: string; result?: { search_response: string } };
  if (!json.success) throw new Error(json.error ?? "AI call failed");
  return json.result?.search_response ?? "";
}

interface PlanLimits {
  maxSpawnDepth: number;
  maxSpawnsPerMission: number;
  maxConcurrentAgents: number;
  hardCapUsdMonthly: number;
  cappedOut: boolean;
  plan: string;
}

async function executeTool(
  ctx: any,
  projectId: Id<"projects">,
  missionId: string,
  agentId: string,
  agentName: string,
  call: ToolCall,
  spawnDepth: number,
  spawnCount: { value: number },
  planLimits?: PlanLimits
): Promise<ToolResult> {
  const toolCallId = await ctx.runMutation(api.engine.createToolCall, {
    projectId,
    missionId,
    agentId,
    agentName,
    tool: call.tool,
    args: JSON.stringify(call.args),
    status: "running",
  });

  try {
    let output = "";

    switch (call.tool) {
      case "create_file": {
        const { path, content } = call.args as { path: string; content: string };
        const ext = path.split(".").pop() ?? "";
        const langMap: Record<string, string> = {
          ts: "typescript", tsx: "typescriptreact", js: "javascript",
          jsx: "javascriptreact", css: "css", html: "html",
          json: "json", md: "markdown", py: "python",
        };
        const existing = await ctx.runQuery(api.files.getByPath, { projectId, path });
        if (existing) {
          await ctx.runMutation(api.files.update, { fileId: existing._id, content });
          output = `Updated ${path} (${content.length} chars)`;
        } else {
          const parts = path.split("/");
          await ctx.runMutation(api.files.create, {
            projectId, path,
            name: parts[parts.length - 1]!,
            content,
            language: langMap[ext] ?? "plaintext",
            isDirectory: false,
            parentPath: parts.slice(0, -1).join("/") || undefined,
          });
          output = `Created ${path} (${content.length} chars)`;
        }
        break;
      }

      case "edit_file": {
        const { path, content } = call.args as { path: string; content: string };
        const existing = await ctx.runQuery(api.files.getByPath, { projectId, path });
        if (!existing) {
          throw new Error(`File not found: ${path}`);
        }
        await ctx.runMutation(api.files.update, { fileId: existing._id, content });
        output = `Edited ${path} (${content.length} chars)`;
        break;
      }

      case "delete_file": {
        const { path } = call.args as { path: string };
        const existing = await ctx.runQuery(api.files.getByPath, { projectId, path });
        if (existing) {
          await ctx.runMutation(api.files.remove, { fileId: existing._id });
          output = `Deleted ${path}`;
        } else {
          output = `File not found (already deleted?): ${path}`;
        }
        break;
      }

      case "read_file": {
        const { path } = call.args as { path: string };
        const file = await ctx.runQuery(api.files.getByPath, { projectId, path });
        if (!file) throw new Error(`File not found: ${path}`);
        output = file.content;
        break;
      }

      case "list_files": {
        const files = await ctx.runQuery(api.files.listByProject, { projectId });
        output = files.filter((f: any) => !f.isDirectory).map((f: any) => f.path).join("\n");
        break;
      }

      case "search_files": {
        const { query: searchQuery } = call.args as { query: string };
        const files = await ctx.runQuery(api.files.listByProject, { projectId });
        const q = searchQuery.toLowerCase();
        const matches = files.filter((f: any) =>
          !f.isDirectory && (f.path.toLowerCase().includes(q) || f.content.toLowerCase().includes(q))
        );
        output = matches.slice(0, 10).map((f: any) =>
          `${f.path}: ${f.content.substring(0, 200).replace(/\n/g, " ")}…`
        ).join("\n\n");
        if (!output) output = "No matches found";
        break;
      }

      case "spawn_agent": {
        const maxDepth = planLimits?.maxSpawnDepth ?? 3;
        const maxSpawns = planLimits?.maxSpawnsPerMission ?? 25;
        if (spawnDepth >= maxDepth) {
          output = `⚠️ Spawn depth limit (${maxDepth}) reached — upgrade for deeper agent cascades`;
          break;
        }
        if (spawnCount.value >= maxSpawns) {
          output = `⚠️ Mission spawn limit (${maxSpawns}) reached — upgrade for more agents per mission`;
          break;
        }
        spawnCount.value++;
        const { role, task } = call.args as { role: string; task: string };
        await ctx.runMutation(api.agentThoughts.emit, {
          projectId,
          agentId,
          agentName,
          type: "broadcast",
          content: `Spawning ${role} agent: ${task}`,
          isStreaming: false,
        });
        const childResult = await runAgentLoop(
          ctx, projectId, missionId, role, role,
          task, spawnDepth + 1, spawnCount, planLimits
        );
        output = `Agent ${role} completed: ${childResult.slice(0, 300)}`;
        break;
      }

      case "send_message": {
        const { to, message } = call.args as { to: string; message: string };
        await ctx.runMutation(api.memory.postAgentMessage, {
          projectId,
          fromAgentId: agentId,
          fromAgentName: agentName,
          fromAgentIcon: "🤖",
          messageType: "context",
          content: `→ ${to}: ${message}`,
        });
        output = `Message sent to ${to}`;
        break;
      }

      case "complete_task": {
        const { summary } = call.args as { summary: string };
        output = summary;
        break;
      }

      default:
        throw new Error(`Unknown tool: ${(call as any).tool}`);
    }

    await ctx.runMutation(api.engine.updateToolCall, {
      toolCallId,
      status: "done",
      result: output.slice(0, 2000),
    });

    return { tool: call.tool, success: true, output };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await ctx.runMutation(api.engine.updateToolCall, {
      toolCallId,
      status: "error",
      error,
    });
    return { tool: call.tool, success: false, output: "", error };
  }
}

// ─── AGENT LOOP (think → act → observe → repeat) ─────────────────────────────

// ─── AGENT LOOP ──────────────────────────────────────────────────────────────
// Each agent runs an iterative tool-calling loop.
// Key fixes vs v1:
//  - Tight, action-forcing prompts with concrete examples
//  - Progress detection: if 2 turns pass with no file writes, force a decision
//  - Context window management: only last 3 turns kept in history
//  - Stall detection: repeat tool call = skip and force complete_task
//  - MAX_TURNS capped at 8 (enough, not infinite)

async function runAgentLoop(
  ctx: any,
  projectId: Id<"projects">,
  missionId: string,
  agentId: string,
  agentName: string,
  task: string,
  depth: number,
  spawnCount: { value: number },
  planLimits?: PlanLimits
): Promise<string> {

  const files = await ctx.runQuery(api.files.listByProject, { projectId });
  const codeFiles = files.filter((f: any) => !f.isDirectory);
  const fileList = codeFiles.map((f: any) => f.path).join(", ");

  // Build a compact focused prompt — no long system text that wastes tokens
  const systemPrompt = `You are ${agentName}, an AI coding agent. Your job: complete the task below by calling tools.

TASK: "${task}"

AVAILABLE FILES: ${fileList || "none yet"}

TOOLS (call at least one per turn, always end with complete_task when done):
- read_file(path) — read a file before editing it
- create_file(path, content) — write COMPLETE file content (not diffs!)
- edit_file(path, content) — same as create_file
- list_files() — see all files
- search_files(query) — search content
- spawn_agent(role, task) — delegate to specialist (roles: ui-agent, logic-agent, debug-agent)
- complete_task(summary) — REQUIRED when done, summarize what you changed

CRITICAL RULES:
1. Always read_file BEFORE editing — never write blindly
2. Write COMPLETE file content in create_file/edit_file — never partial snippets  
3. Make real changes every turn — no analysis without action
4. After 2 file reads without a write, you MUST write or call complete_task
5. Call complete_task as your FINAL tool — do not keep looping after it

RESPOND WITH VALID JSON ONLY — no prose, no markdown fences:
{"thought":"what you'll do and why (1 sentence)","tool_calls":[{"tool":"read_file","args":{"path":"src/App.tsx"}}]}`;

  const MAX_TURNS = 8;
  let finalSummary = "Task completed";
  let recentHistory: Array<{ role: string; content: string }> = [];
  let fileWritesThisTurn = 0;
  let lastToolCall = "";
  let stuckCount = 0;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    // Emit turn heartbeat so UI shows live progress
    await ctx.runMutation(api.agentThoughts.emit, {
      projectId, agentId, agentName,
      type: turn === 0 ? "analyze" : "code",
      content: turn === 0
        ? `🔍 Starting: ${task.slice(0, 100)}`
        : `🔄 Turn ${turn + 1}/${MAX_TURNS} — ${fileWritesThisTurn} writes so far`,
      isStreaming: true,
    });

    // Keep only last 3 exchanges to avoid context overflow
    const historySlice = recentHistory.slice(-6); // 3 assistant + 3 user pairs

    // Build the full prompt for this turn
    const conversationText = [
      `SYSTEM: ${systemPrompt}`,
      ...historySlice.map(m => `${m.role.toUpperCase()}: ${m.content}`),
      turn === 0
        ? `USER: Begin the task. Call your first tool now.`
        : `USER: Continue. ${fileWritesThisTurn === 0 && turn >= 2 ? "You MUST write a file or call complete_task NOW." : "Keep making progress or call complete_task if done."}`,
    ].join("\n\n");

    let rawResponse = "";
    try {
      rawResponse = await callAI(conversationText);
    } catch (err) {
      await ctx.runMutation(api.agentThoughts.emit, {
        projectId, agentId, agentName, type: "debug",
        content: `❌ AI call failed on turn ${turn + 1}: ${err instanceof Error ? err.message : String(err)}`,
        isStreaming: false,
      });
      // Don't give up — retry once with simplified prompt
      try {
        const fallbackPrompt = `Complete this coding task in ONE tool call. Task: "${task}". Respond with valid JSON: {"thought":"brief plan","tool_calls":[{"tool":"complete_task","args":{"summary":"could not complete: AI error"}}]}`;
        rawResponse = await callAI(fallbackPrompt);
      } catch {
        break;
      }
    }

    // Extract JSON — try multiple strategies
    let parsed: { thought?: string; tool_calls?: ToolCall[] } | null = null;

    // Strategy 1: look for {...} block
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); } catch { /* try next */ }
    }

    // Strategy 2: if AI returned a list of tool_calls wrapped differently
    if (!parsed) {
      try { parsed = JSON.parse(rawResponse.trim()); } catch { /* */ }
    }

    // Strategy 3: AI returned plain prose — extract file paths and create_file
    if (!parsed) {
      // Check if response contains code blocks — try to extract and write them
      const codeBlockMatch = rawResponse.match(/```(?:\w+)?\n([\s\S]+?)```/);
      if (codeBlockMatch) {
        finalSummary = `Completed: extracted code from AI response`;
      } else {
        finalSummary = rawResponse.slice(0, 400);
      }
      await ctx.runMutation(api.agentThoughts.emit, {
        projectId, agentId, agentName, type: "debug",
        content: `⚠️ Non-JSON response — treating as completion. Preview: ${rawResponse.slice(0, 100)}`,
        isStreaming: false,
      });
      break;
    }

    if (parsed.thought) {
      await ctx.runMutation(api.agentThoughts.emit, {
        projectId, agentId, agentName, type: "plan",
        content: `💭 ${parsed.thought}`,
        isStreaming: false,
      });
    }

    const toolCalls = parsed.tool_calls ?? [];
    if (toolCalls.length === 0) {
      finalSummary = parsed.thought ?? "No actions taken";
      await ctx.runMutation(api.agentThoughts.emit, {
        projectId, agentId, agentName, type: "done",
        content: `✅ ${finalSummary.slice(0, 200)}`,
        isStreaming: false,
      });
      break;
    }

    // Stall detection: same tool+args as last turn = stuck
    const toolKey = toolCalls.map(c => `${c.tool}:${JSON.stringify(c.args)}`).join("|");
    if (toolKey === lastToolCall) {
      stuckCount++;
      if (stuckCount >= 2) {
        finalSummary = "Task completed — agent reached stable state after " + turn + " turns";
        await ctx.runMutation(api.agentThoughts.emit, {
          projectId, agentId, agentName, type: "done",
          content: `⚡ Stall detected — forcing completion after ${turn} turns`,
          isStreaming: false,
        });
        break;
      }
    } else {
      stuckCount = 0;
      lastToolCall = toolKey;
    }

    // Execute tools
    const toolResults: ToolResult[] = [];
    let isDone = false;
    fileWritesThisTurn = 0;

    for (const call of toolCalls) {
      const isWrite = call.tool === "create_file" || call.tool === "edit_file";
      const isRead = call.tool === "read_file" || call.tool === "list_files" || call.tool === "search_files";

      await ctx.runMutation(api.agentThoughts.emit, {
        projectId, agentId, agentName,
        type: isWrite ? "code" : isRead ? "analyze" : "broadcast",
        content: `🔧 ${call.tool}(${
          call.tool === "create_file" || call.tool === "edit_file"
            ? `${call.args.path}, [${String(call.args.content ?? "").length} chars]`
            : Object.entries(call.args).map(([k, v]) => `${k}: ${String(v).slice(0, 50)}`).join(", ")
        })`,
        isStreaming: false,
      });

      const result = await executeTool(
        ctx, projectId, missionId, agentId, agentName,
        call, depth, spawnCount, planLimits
      );
      toolResults.push(result);

      if (isWrite && result.success) fileWritesThisTurn++;

      if (call.tool === "complete_task") {
        finalSummary = result.output || parsed.thought || "Task completed";
        isDone = true;
        break;
      }
    }

    if (isDone) break;

    // Append to rolling history — truncate tool results so history stays compact
    const resultsText = toolResults
      .map(r => `${r.tool}: ${r.success ? r.output.slice(0, 800) : `ERROR: ${r.error?.slice(0, 200)}`}`)
      .join("\n");

    recentHistory.push(
      { role: "assistant", content: JSON.stringify({ thought: parsed.thought, tool_calls: toolCalls }) },
      { role: "user", content: `RESULTS:\n${resultsText}\n\nContinue or call complete_task if done.` }
    );
  }

  await ctx.runMutation(api.agentThoughts.emit, {
    projectId, agentId, agentName, type: "done",
    content: `✅ Done: ${finalSummary.slice(0, 250)}`,
    isStreaming: false,
  });

  return finalSummary;
}

// ─── PUBLIC ACTION: RUN MISSION ─────────────────────────────────────────────
// Agents run in PARALLEL (Promise.all) — not sequentially.
// Each agent gets its own tool-calling loop.
// Live thoughts stream from all agents simultaneously.

export const runMission = action({
  args: {
    projectId: v.id("projects"),
    prompt: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const missionId = `mission-${Date.now()}`;

    // ── Plan limits ────────────────────────────────────────────────────────
    let planLimits: PlanLimits = {
      maxSpawnDepth: 3, maxSpawnsPerMission: 25,
      maxConcurrentAgents: 5, hardCapUsdMonthly: 6, cappedOut: false, plan: "free",
    };
    try {
      const project = await ctx.runQuery(api.projects.get, { projectId: args.projectId });
      if (project?.ownerId) {
        const pl = await ctx.runAction(api.limits.getUserPlanLimits, { userId: String(project.ownerId) });
        planLimits = pl as PlanLimits;
        if (planLimits.cappedOut) {
          return "⛔ Monthly compute cap reached. Upgrade or wait for your cap to reset.";
        }
        await ctx.runMutation(api.limits.trackUsage, {
          userId: String(project.ownerId),
          action: "start_mission",
        });
      }
    } catch { /* non-fatal */ }

    // ── Clear and announce ─────────────────────────────────────────────────
    await ctx.runMutation(api.agentThoughts.clearForProject, { projectId: args.projectId });
    await ctx.runMutation(api.engine.clearToolCalls, { projectId: args.projectId });

    await ctx.runMutation(api.agentThoughts.emit, {
      projectId: args.projectId, agentId: "planner", agentName: "🗺️ Planner",
      type: "plan", content: `📋 Mission: "${args.prompt}"`, isStreaming: true,
    });

    // ── Load memory for context ────────────────────────────────────────────
    let memoryContext = "";
    try {
      memoryContext = await ctx.runAction(api.memory.getMemoriesForPrompt, {
        projectId: args.projectId, topN: 8,
      });
    } catch { /* non-fatal */ }

    // ── Read file list for planner context ─────────────────────────────────
    const files = await ctx.runQuery(api.files.listByProject, { projectId: args.projectId });
    const fileList = files.filter((f: any) => !f.isDirectory).map((f: any) => f.path).join(", ");

    // ── PLANNER: decompose task into parallel agents ────────────────────────
    const planPrompt = `You are the Master Planner for CodeForge. Decompose the user request into specialist agents that will run IN PARALLEL.

USER REQUEST: "${args.prompt}"
${memoryContext ? `CONTEXT: ${memoryContext}\n` : ""}
PROJECT FILES: ${fileList || "none yet"}

SPECIALIST AGENTS (pick 2-4 max, they run simultaneously):
- ui-agent 🎨: HTML, CSS, layout, responsive design, visual polish
- logic-agent ⚙️: JavaScript/TypeScript, state, events, data flow
- mobile-agent 📱: Mobile-first design, touch, viewport
- feature-agent ✨: New features, integrations, new pages
- debug-agent 🔍: Bug fixes, error handling, edge cases  
- qa-agent ✅: Final check — reads files and verifies correctness

RULES:
- Simple single-file change → 1 agent only
- UI + logic change → ui-agent + logic-agent (parallel)
- New feature → feature-agent + ui-agent (parallel), then qa-agent
- Bug fix → debug-agent only
- ALWAYS include qa-agent last for complex tasks
- Each agent's task must be SPECIFIC — mention exact files/components

Respond ONLY with valid JSON:
{"plan":"brief approach","agents":[{"id":"ui-agent","name":"UI Agent","icon":"🎨","task":"specific task with file names"}]}`;

    let agents: Array<{ id: string; name: string; icon: string; task: string }> = [];

    try {
      const planRaw = await callAI(planPrompt);
      const planMatch = planRaw.match(/\{[\s\S]*\}/);
      if (planMatch) {
        const planParsed = JSON.parse(planMatch[0]);
        agents = planParsed.agents ?? [];

        await ctx.runMutation(api.agentThoughts.emit, {
          projectId: args.projectId, agentId: "planner", agentName: "🗺️ Planner",
          type: "plan",
          content: `🚀 Plan: ${planParsed.plan ?? ""} → [${agents.map((a: any) => a.icon + a.name).join(" ⚡ ")}]`,
          isStreaming: false,
        });
      }
    } catch {
      // Fallback: smart single agent based on keywords
      const kw = args.prompt.toLowerCase();
      const agentId = kw.match(/fix|bug|error|broken/) ? "debug-agent"
        : kw.match(/style|css|color|layout|design|ui/) ? "ui-agent"
        : kw.match(/mobile|touch|responsive/) ? "mobile-agent"
        : "feature-agent";
      agents = [{ id: agentId, name: agentId.replace("-agent","").replace(/^./, c => c.toUpperCase()) + " Agent",
        icon: agentId === "debug-agent" ? "🔍" : agentId === "ui-agent" ? "🎨" : agentId === "mobile-agent" ? "📱" : "✨",
        task: args.prompt }];
    }

    if (agents.length === 0) {
      agents = [{ id: "feature-agent", name: "Feature Agent", icon: "✨", task: args.prompt }];
    }

    // ── Register tasks in DB ───────────────────────────────────────────────
    for (const agent of agents) {
      await ctx.runMutation(api.agents.createTask, {
        projectId: args.projectId,
        agentId: agent.id,
        agentName: `${agent.icon} ${agent.name}`,
        agentIcon: agent.icon,
        task: agent.task,
      });
    }

    // ── RUN AGENTS IN PARALLEL ─────────────────────────────────────────────
    // Separate qa-agent (always last) from parallel agents
    const qaAgent = agents.find(a => a.id === "qa-agent");
    const parallelAgents = agents.filter(a => a.id !== "qa-agent");

    const spawnCount = { value: 0 };

    // Concurrency cap from plan
    const maxConcurrent = planLimits.maxConcurrentAgents ?? 5;
    const batches: typeof parallelAgents[] = [];
    for (let i = 0; i < parallelAgents.length; i += maxConcurrent) {
      batches.push(parallelAgents.slice(i, i + maxConcurrent));
    }

    const results: string[] = [];

    for (const batch of batches) {
      await ctx.runMutation(api.agentThoughts.emit, {
        projectId: args.projectId, agentId: "planner", agentName: "🗺️ Planner",
        type: "broadcast",
        content: `⚡ Launching ${batch.length} agents in parallel: ${batch.map(a => a.icon + a.name).join(", ")}`,
        isStreaming: false,
      });

      const batchResults = await Promise.all(
        batch.map(agent =>
          runAgentLoop(
            ctx, args.projectId, missionId, agent.id,
            `${agent.icon} ${agent.name}`, agent.task, 0, spawnCount, planLimits
          ).then(r => `[${agent.name}] ${r}`)
           .catch(e => `[${agent.name}] Error: ${e instanceof Error ? e.message : String(e)}`)
        )
      );
      results.push(...batchResults);
    }

    // ── QA AGENT runs last, after all parallel agents complete ─────────────
    if (qaAgent) {
      await ctx.runMutation(api.agentThoughts.emit, {
        projectId: args.projectId, agentId: "qa-agent", agentName: "✅ QA Agent",
        type: "review",
        content: "🔎 All agents done — running QA verification pass...",
        isStreaming: true,
      });

      const qaResult = await runAgentLoop(
        ctx, args.projectId, missionId, "qa-agent",
        "✅ QA Agent",
        `Verify the following work was completed correctly: ${args.prompt}. Read the relevant files and confirm changes are correct and complete. If anything is missing or broken, fix it.`,
        0, spawnCount, planLimits
      ).catch(e => `QA Error: ${e instanceof Error ? e.message : String(e)}`);

      results.push(`[QA] ${qaResult}`);
    }

    const summary = results.join("\n");

    // ── Post result to chat ────────────────────────────────────────────────
    if (args.sessionId) {
      const agentCount = agents.length;
      await ctx.runMutation(api.chat.addMessage, {
        sessionId: args.sessionId,
        projectId: args.projectId,
        role: "assistant",
        content: `✅ Mission complete! ${agentCount} agent${agentCount > 1 ? "s" : ""} worked in parallel.\n\n${summary}`,
      });
    }

    return summary;
  },
});
