import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

declare const process: { env: Record<string, string | undefined> };

const VIKTOR_API_URL = process.env.VIKTOR_SPACES_API_URL!;
const PROJECT_NAME = process.env.VIKTOR_SPACES_PROJECT_NAME!;
const PROJECT_SECRET = process.env.VIKTOR_SPACES_PROJECT_SECRET!;

// ─── AI CALL ─────────────────────────────────────────────────────────────────

async function callAI(
  prompt: string,
  _model = "deepseek-v4-flash",   // model param kept for API compat but Viktor uses quick_ai_search role
  _maxTokens = 6000
): Promise<string> {
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

// ─── AGENT ROSTER ────────────────────────────────────────────────────────────

const AGENT_TYPES = [
  {
    id: "planner-agent",
    name: "Planner",
    icon: "🗺️",
    specialty: "Decomposing tasks, assigning work to specialists, coordinating the overall approach",
  },
  {
    id: "ui-agent",
    name: "UI Agent",
    icon: "🎨",
    specialty: "HTML structure, CSS styling, layout, responsive design, animations, and visual polish",
  },
  {
    id: "mobile-agent",
    name: "Mobile Agent",
    icon: "📱",
    specialty: "Mobile-first responsive design, touch interactions, viewport handling, bottom nav patterns",
  },
  {
    id: "logic-agent",
    name: "Logic Agent",
    icon: "⚙️",
    specialty: "JavaScript/TypeScript logic, event handling, state management, and application behavior",
  },
  {
    id: "debug-agent",
    name: "Debug Agent",
    icon: "🔍",
    specialty: "Finding and fixing bugs, error handling, edge cases, and code quality",
  },
  {
    id: "feature-agent",
    name: "Feature Agent",
    icon: "✨",
    specialty: "Adding new features, integrations, and functionality enhancements",
  },
  {
    id: "test-agent",
    name: "Test Agent",
    icon: "🧪",
    specialty: "Writing tests, validating logic, checking edge cases and error paths",
  },
  {
    id: "reviewer-agent",
    name: "Reviewer",
    icon: "🔎",
    specialty: "Code review, security checks, performance analysis, and best practice enforcement",
  },
  {
    id: "qa-agent",
    name: "QA Agent",
    icon: "✅",
    specialty: "Quality assurance — verifies that all agents completed their tasks correctly, catches regressions, checks mobile/desktop breakpoints",
  },
];

// ─── HELPER: emit thought ────────────────────────────────────────────────────

type ThoughtType = "plan" | "analyze" | "code" | "debug" | "review" | "memory" | "search" | "commit" | "broadcast" | "done";

async function think(
  ctx: { runMutation: Function },
  projectId: Id<"projects">,
  agentId: string,
  agentName: string,
  type: ThoughtType,
  content: string,
  isStreaming = false
) {
  await ctx.runMutation(api.agentThoughts.emit, {
    projectId,
    agentId,
    agentName,
    type,
    content,
    isStreaming,
  });
}

// ─── QUERIES ─────────────────────────────────────────────────────────────────

export const listTasks = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("agentTasks"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      buildSessionId: v.optional(v.id("buildSessions")),
      agentId: v.string(),
      agentName: v.string(),
      agentIcon: v.string(),
      task: v.string(),
      status: v.union(
        v.literal("queued"),
        v.literal("running"),
        v.literal("done"),
        v.literal("error")
      ),
      result: v.optional(v.string()),
      filesChanged: v.optional(v.array(v.string())),
      startedAt: v.number(),
      finishedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentTasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(50);
  },
});

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

export const createTask = mutation({
  args: {
    projectId: v.id("projects"),
    buildSessionId: v.optional(v.id("buildSessions")),
    agentId: v.string(),
    agentName: v.string(),
    agentIcon: v.string(),
    task: v.string(),
  },
  returns: v.id("agentTasks"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentTasks", {
      ...args,
      status: "queued",
      startedAt: Date.now(),
    });
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("agentTasks"),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("done"),
      v.literal("error")
    ),
    result: v.optional(v.string()),
    filesChanged: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.result !== undefined) patch.result = args.result;
    if (args.filesChanged !== undefined) patch.filesChanged = args.filesChanged;
    if (args.status === "done" || args.status === "error") {
      patch.finishedAt = Date.now();
    }
    await ctx.db.patch(args.taskId, patch);
    return null;
  },
});

// ─── MAIN: AUTONOMOUS MULTI-AGENT ACTION ─────────────────────────────────────

export const runMultiAgent = action({
  args: {
    projectId: v.id("projects"),
    prompt: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const projectId = args.projectId;

    // Clear old thoughts
    await ctx.runMutation(api.agentThoughts.clearForProject, { projectId });

    await think(ctx, projectId, "planner-agent", "Planner", "plan",
      `Task received: "${args.prompt}"`, true);

    // ── 1. LOAD MEMORY ────────────────────────────────────────────────────────
    await think(ctx, projectId, "planner-agent", "Planner", "memory",
      "Loading persistent memory bank...", true);

    const memoryContext = await ctx.runAction(api.memory.getMemoriesForPrompt, {
      projectId,
      topN: 20,
    });

    await think(ctx, projectId, "planner-agent", "Planner", "memory",
      memoryContext
        ? `Memory loaded — ${memoryContext.split("\n").length} entries including past patterns, preferences, and anti-patterns`
        : "No prior memory — starting fresh");


    // ── 1b. LOAD PROJECT SOUL ─────────────────────────────────────────────────
    const projectSettings = await ctx.runQuery(api.suggestions.getAutonomousMode, { projectId });
    const projectSoul = projectSettings?.projectSoul ?? "";
    const soulSection = projectSoul
      ? `\n\nPROJECT SOUL — THE CORE IDENTITY (NEVER VIOLATE THIS):\n${projectSoul}\n\nEVERY change you make MUST be additive and consistent with this soul. The QA agent will reject anything that contradicts it.`
      : "";

    // ── 2. LOAD ALL FILES ─────────────────────────────────────────────────────
    const files = await ctx.runQuery(api.files.listByProject, { projectId });
    const codeFiles = files.filter((f: any) => !f.isDirectory);

    await think(ctx, projectId, "planner-agent", "Planner", "search",
      `Indexing ${codeFiles.length} files for semantic search...`, true);

    // RAG index + relevant context
    let ragContext = "";
    try {
      await ctx.runAction(api.rag.indexProject, { projectId });
      ragContext = await ctx.runAction(api.rag.getContextForPrompt, {
        projectId,
        query: args.prompt,
      });
      if (ragContext) {
        const matchCount = (ragContext.match(/---/g) ?? []).length / 2;
        await think(ctx, projectId, "planner-agent", "Planner", "search",
          `Semantic search complete — ${matchCount} highly relevant files identified`);
      }
    } catch { /* non-fatal */ }

    const fileList = codeFiles.map((f: any) => f.path).join(", ");
    const fileContext = codeFiles
      .map((f: any) => `--- ${f.path} ---\n${f.content}`)
      .join("\n\n");

    // ── 3. PLANNER PHASE ──────────────────────────────────────────────────────
    await think(ctx, projectId, "planner-agent", "Planner", "plan",
      "Running deep task analysis and decomposing into specialized subtasks...", true);

    const planPrompt = `You are CodeForge's Master Planner. You orchestrate an autonomous multi-agent coding system.

USER REQUEST: "${args.prompt}"${soulSection}

${memoryContext ? `LEARNED CONTEXT FROM MEMORY:\n${memoryContext}\n` : ""}

PROJECT FILES: ${fileList}

AVAILABLE SPECIALIST AGENTS:
${AGENT_TYPES.filter(a => a.id !== "planner-agent").map(a => `- ${a.id} (${a.name}): ${a.specialty}`).join("\n")}

RULES:
- Always include reviewer-agent for ANY complex task (3+ agents)
- Always include qa-agent as the FINAL agent to verify everything is correct
- Always include mobile-agent if the task touches any UI/CSS/layout files
- For simple tasks: 2-3 agents max
- For complex tasks: up to 6 agents (including reviewer + qa)
- Make each task description extremely detailed and specific
- Agents run SEQUENTIALLY — each can see what previous agents did

COMPLEXITY LEVELS:
- simple: single concern, 1-2 agents
- moderate: 2-4 agents, clear domain boundaries
- complex: 4-6 agents, major feature or architectural change

Return ONLY valid JSON (no markdown fences):
{
  "complexity": "simple|moderate|complex",
  "reasoning": "detailed explanation of the approach",
  "agents": [
    { "agentId": "ui-agent", "task": "Very specific, detailed task description with exact files to touch" }
  ]
}`;

    const planResult = await callAI(planPrompt, "deepseek-v4-flash", 3000);
    const planMatch = planResult.match(/\{[\s\S]*\}/);
    if (!planMatch) throw new Error("Planner failed to produce a valid plan");

    const plan = JSON.parse(planMatch[0]) as {
      complexity: string;
      reasoning: string;
      agents: Array<{ agentId: string; task: string }>;
    };

    await think(ctx, projectId, "planner-agent", "Planner", "plan",
      `Plan (${plan.complexity}): ${plan.reasoning}\nAgents: ${plan.agents.map(a => a.agentId).join(" → ")}`);

    // ── 4. CREATE TASK RECORDS ────────────────────────────────────────────────
    type TaskRecord = {
      taskId: Id<"agentTasks">;
      agentId: string;
      agentName: string;
      agentIcon: string;
      task: string;
    };
    const taskRecords: TaskRecord[] = [];

    for (const planned of plan.agents) {
      const agentDef = AGENT_TYPES.find(a => a.id === planned.agentId) ?? AGENT_TYPES[1]!;
      const taskId = await ctx.runMutation(api.agents.createTask, {
        projectId,
        agentId: agentDef.id,
        agentName: agentDef.name,
        agentIcon: agentDef.icon,
        task: planned.task,
      });
      taskRecords.push({
        taskId,
        agentId: agentDef.id,
        agentName: agentDef.name,
        agentIcon: agentDef.icon,
        task: planned.task,
      });
    }

    // ── 5. EXECUTE AGENTS SEQUENTIALLY ───────────────────────────────────────
    type AgentResult = {
      agentId: string;
      agentName: string;
      task: string;
      status: string;
      result?: string;
      filesChanged?: string[];
      broadcast?: string;
    };
    const results: AgentResult[] = [];
    const agentBroadcasts: string[] = [];

    // Track all file changes across agents for QA
    const allChangedFiles = new Set<string>();

    for (const t of taskRecords) {
      const agentDef = AGENT_TYPES.find(a => a.id === t.agentId) ?? AGENT_TYPES[1]!;

      await ctx.runMutation(api.agents.updateTask, {
        taskId: t.taskId,
        status: "running",
      });

      await ctx.runMutation(api.memory.postAgentMessage, {
        projectId,
        fromAgentId: t.agentId,
        fromAgentName: t.agentName,
        fromAgentIcon: t.agentIcon,
        messageType: "context",
        content: `Starting: ${t.task}`,
      });

      await think(ctx, projectId, t.agentId, t.agentName, "analyze",
        t.task, true);

      const priorContext = agentBroadcasts.length > 0
        ? `\n\nMESSAGES FROM AGENTS BEFORE YOU:\n${agentBroadcasts.join("\n")}`
        : "";

      // For QA agent — give it the full change summary
      const isQA = t.agentId === "qa-agent";
      const qaContext = isQA
        ? `\n\nWHAT ALL AGENTS DID:\n${results.map(r => `[${r.agentName}] ${r.result ?? "no result"} — files: ${(r.filesChanged ?? []).join(", ")}`).join("\n")}`
        : "";

      const agentPrompt = `You are ${agentDef.name}, a specialist AI agent in the CodeForge autonomous coding system.
Specialty: ${agentDef.specialty}${soulSection}

${memoryContext ? `PERSISTENT MEMORY (what this project has learned over time):\n${memoryContext}\n` : ""}

ORIGINAL USER REQUEST: "${args.prompt}"
YOUR SPECIFIC TASK: ${t.task}
PLAN: ${plan.complexity} — ${plan.reasoning}
${priorContext}
${qaContext}

${ragContext ? `MOST RELEVANT FILES (via semantic search):\n${ragContext}\n` : ""}

ALL PROJECT FILES:
${fileContext}

INSTRUCTIONS:
1. Focus on YOUR specific task only — don't redo what others did
2. Write COMPLETE file contents — never partial diffs or placeholders
3. Be thorough — check edge cases, handle errors, follow existing code style
4. If you are mobile-agent: ensure ALL touch targets ≥44px, no horizontal scroll, all panels work on 375px width
5. If you are reviewer-agent: review the actual file contents above for real issues and fix them
6. If you are qa-agent: verify every agent's changes are consistent, catch regressions, check that mobile/desktop both work. ALSO verify that NO changes violate the Project Soul — if they do, flag it clearly in your summary and reject the change in your broadcast
7. Save key learnings in your broadcast so memory can be updated

Return ONLY valid JSON (no markdown fences):
{
  "changes": [
    { "path": "src/path/file.tsx", "action": "edit", "content": "COMPLETE file content here" }
  ],
  "summary": "Detailed description of what you did and why",
  "broadcast": {
    "messageType": "finding|warning|context|resolved",
    "content": "Specific message to other agents or for memory — mention patterns, gotchas, or decisions made"
  },
  "learnings": [
    "Key pattern or insight worth remembering for future tasks"
  ],
  "filesChanged": ["src/path/file.tsx"]
}`;

      try {
        await think(ctx, projectId, t.agentId, t.agentName, "code",
          "Working...", true);

        const agentResult = await callAI(agentPrompt, "deepseek-v4-flash", 8000);
        const jsonMatch = agentResult.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Non-JSON output from agent");

        const parsed = JSON.parse(jsonMatch[0]) as {
          changes?: Array<{ path: string; action: string; content: string }>;
          summary?: string;
          broadcast?: { messageType: string; content: string };
          learnings?: string[];
          filesChanged?: string[];
        };

        // Apply file changes
        const changedPaths: string[] = [];
        for (const change of (parsed.changes ?? [])) {
          try {
            const existing = await ctx.runQuery(api.files.getByPath, {
              projectId,
              path: change.path,
            });
            if (existing) {
              await ctx.runMutation(api.files.update, {
                fileId: existing._id,
                content: change.content,
              });
            } else if (change.action === "create") {
              const parts = change.path.split("/");
              await ctx.runMutation(api.files.create, {
                projectId,
                path: change.path,
                name: parts[parts.length - 1]!,
                content: change.content,
                isDirectory: false,
                parentPath: parts.slice(0, -1).join("/") || undefined,
              });
            }
            changedPaths.push(change.path);
            allChangedFiles.add(change.path);
          } catch (fileErr) {
            await think(ctx, projectId, t.agentId, t.agentName, "debug",
              `Warning: could not write ${change.path} — ${String(fileErr)}`);
          }
        }

        // Broadcast to other agents
        if (parsed.broadcast) {
          const validTypes = ["warning", "context", "request", "finding", "blocker", "resolved"];
          const msgType = validTypes.includes(parsed.broadcast.messageType)
            ? parsed.broadcast.messageType as "warning" | "context" | "request" | "finding" | "blocker" | "resolved"
            : "finding";

          await ctx.runMutation(api.memory.postAgentMessage, {
            projectId,
            fromAgentId: t.agentId,
            fromAgentName: t.agentName,
            fromAgentIcon: t.agentIcon,
            messageType: msgType,
            content: parsed.broadcast.content,
            relatedFiles: changedPaths,
          });
          agentBroadcasts.push(`[${t.agentName}] ${parsed.broadcast.content}`);
        }

        // Store learnings as memories
        for (const learning of (parsed.learnings ?? [])) {
          try {
            await ctx.runMutation(api.memory.addMemory, {
              projectId,
              category: "insight",
              content: learning,
              importance: 6,


            });
          } catch { /* non-fatal */ }
        }

        await think(ctx, projectId, t.agentId, t.agentName, "done",
          `${parsed.summary ?? "Done"} — ${changedPaths.length} file(s) changed: ${changedPaths.join(", ") || "none"}`);

        await ctx.runMutation(api.agents.updateTask, {
          taskId: t.taskId,
          status: "done",
          result: parsed.summary ?? "Completed",
          filesChanged: changedPaths,
        });

        results.push({
          agentId: t.agentId,
          agentName: t.agentName,
          task: t.task,
          status: "done",
          result: parsed.summary,
          filesChanged: changedPaths,
          broadcast: parsed.broadcast?.content,
        });

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await ctx.runMutation(api.memory.postAgentMessage, {
          projectId,
          fromAgentId: t.agentId,
          fromAgentName: t.agentName,
          fromAgentIcon: t.agentIcon,
          messageType: "blocker",
          content: `Failed: ${errorMsg}`,
        });
        await ctx.runMutation(api.agents.updateTask, {
          taskId: t.taskId,
          status: "error",
          result: errorMsg,
        });
        await think(ctx, projectId, t.agentId, t.agentName, "debug",
          `Error: ${errorMsg}`);
        results.push({
          agentId: t.agentId,
          agentName: t.agentName,
          task: t.task,
          status: "error",
          result: errorMsg,
        });
      }
    }

    // ── 6. RETROSPECTIVE ──────────────────────────────────────────────────────
    await think(ctx, projectId, "retrospective-agent", "Retrospective", "review",
      "Run complete — extracting learnings and updating memory...", true);

    try {
      await ctx.runAction(api.memory.runRetrospective, {
        projectId,
        triggerTaskId: taskRecords[0]?.taskId,
        agentResults: results,
        originalPrompt: args.prompt,
      });
      await think(ctx, projectId, "retrospective-agent", "Retrospective", "memory",
        "Memory updated with patterns and insights from this run");
    } catch (e) {
      console.error("Retrospective failed:", e);
    }

    // ── 7. AUTO-PUSH TO GITHUB ────────────────────────────────────────────────
    const successCount = results.filter(r => r.status === "done").length;
    const totalCount = results.length;

    if (successCount > 0) {
      try {
        const project = await ctx.runQuery(api.projects.get, { projectId });
        if (project?.githubRepo) {
          await think(ctx, projectId, "planner-agent", "Planner", "commit",
            `Auto-pushing to ${project.githubRepo}...`, true);

          const branchName = `agent/${args.prompt.slice(0, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
          const pushResult = await ctx.runAction(api.git.pushToGitHub, {
            projectId,
            repoFullName: project.githubRepo,
            branchName,
            commitMessage: `feat(agent): ${args.prompt.slice(0, 72)}`,
            createPR: true,
            prTitle: args.prompt.slice(0, 100),
            prBody: [
              "## CodeForge Autonomous Agent Run",
              "",
              `**Task:** ${args.prompt}`,
              `**Agents:** ${results.map(r => r.agentName).join(", ")}`,
              `**Files changed:** ${[...allChangedFiles].join(", ")}`,
            ].join("\n"),
          });

          await think(ctx, projectId, "planner-agent", "Planner", "commit",
            pushResult.success
              ? `✓ Pushed to branch \`${branchName}\`${pushResult.prUrl ? ` — PR opened` : ""}`
              : `⚠ Push skipped: ${pushResult.error}`);
        }
      } catch { /* non-fatal */ }
    }

    await think(ctx, projectId, "planner-agent", "Planner", "done",
      `Complete — ${successCount}/${totalCount} agents succeeded · ${allChangedFiles.size} files changed`);

    return results
      .map(r => `${r.agentName} (${r.status}): ${r.result ?? "no result"}`)
      .join("\n");
  },
});
