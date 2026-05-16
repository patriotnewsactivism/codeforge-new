import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";

declare const process: { env: Record<string, string | undefined> };

const VIKTOR_API_URL = process.env.VIKTOR_SPACES_API_URL!;
const PROJECT_NAME = process.env.VIKTOR_SPACES_PROJECT_NAME!;
const PROJECT_SECRET = process.env.VIKTOR_SPACES_PROJECT_SECRET!;

// ── Queries ──

export const getActiveSession = query({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.object({
      _id: v.id("buildSessions"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      userId: v.id("users"),
      status: v.union(
        v.literal("running"),
        v.literal("paused"),
        v.literal("completed"),
        v.literal("error")
      ),
      currentStep: v.optional(v.string()),
      totalSteps: v.optional(v.number()),
      completedSteps: v.optional(v.number()),
      startedAt: v.number(),
      finishedAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("buildSessions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return sessions.find((s) => s.status === "running") ?? null;
  },
});

export const listSteps = query({
  args: { buildSessionId: v.id("buildSessions") },
  returns: v.array(
    v.object({
      _id: v.id("buildSteps"),
      _creationTime: v.number(),
      buildSessionId: v.id("buildSessions"),
      projectId: v.id("projects"),
      stepNumber: v.number(),
      action: v.string(),
      description: v.string(),
      filesChanged: v.array(v.string()),
      status: v.union(v.literal("running"), v.literal("done"), v.literal("error")),
      errorMessage: v.optional(v.string()),
      timestamp: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("buildSteps")
      .withIndex("by_build_session", (q) =>
        q.eq("buildSessionId", args.buildSessionId)
      )
      .collect();
  },
});

// ── Mutations ──

export const createSession = mutation({
  args: { projectId: v.id("projects") },
  returns: v.id("buildSessions"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("buildSessions", {
      projectId: args.projectId,
      userId,
      status: "running",
      startedAt: Date.now(),
      completedSteps: 0,
    });
  },
});

export const addStep = mutation({
  args: {
    buildSessionId: v.id("buildSessions"),
    projectId: v.id("projects"),
    stepNumber: v.number(),
    action: v.string(),
    description: v.string(),
    filesChanged: v.array(v.string()),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("error")),
    errorMessage: v.optional(v.string()),
  },
  returns: v.id("buildSteps"),
  handler: async (ctx, args) => {
    // Update session progress
    await ctx.db.patch(args.buildSessionId, {
      currentStep: args.description,
      completedSteps: args.stepNumber,
    });
    return await ctx.db.insert("buildSteps", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const finishSession = mutation({
  args: {
    buildSessionId: v.id("buildSessions"),
    status: v.union(v.literal("completed"), v.literal("error"), v.literal("paused")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.buildSessionId, {
      status: args.status,
      finishedAt: Date.now(),
    });

    if (args.status === "completed") {
      const session = await ctx.db.get(args.buildSessionId);
      if (session) {
        const project = await ctx.db.get(session.projectId);
        if (project) {
          await ctx.scheduler.runAfter(0, internal.users.notifyBuildComplete, {
            userId: session.userId,
            projectName: project.name,
            projectId: session.projectId,
          });
        }
      }
    }

    return null;
  },
});

// ── Build Loop Action ──
// The AI builds based on a prompt, writes code, checks for errors, fixes them

export const runBuildLoop = action({
  args: {
    projectId: v.id("projects"),
    prompt: v.string(), // what to build
    suggestionId: v.optional(v.id("suggestions")), // if implementing a suggestion
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Create build session
    const buildSessionId = await ctx.runMutation(api.buildLoop.createSession, {
      projectId: args.projectId,
    });

    // Mark suggestion as implementing
    if (args.suggestionId) {
      await ctx.runMutation(api.suggestions.updateStatus, {
        suggestionId: args.suggestionId,
        status: "implementing",
      });
    }

    // Get current files for context
    const files = await ctx.runQuery(api.files.listByProject, {
      projectId: args.projectId,
    });

    const fileContext = files
      .filter((f) => !f.isDirectory)
      .map((f) => `--- ${f.path} ---\n${f.content}`)
      .join("\n\n");

    try {
      // Step 1: Plan what to do
      await ctx.runMutation(api.buildLoop.addStep, {
        buildSessionId,
        projectId: args.projectId,
        stepNumber: 1,
        action: "plan",
        description: "Analyzing project and planning changes...",
        filesChanged: [],
        status: "running",
      });

      const planPrompt = `You are CodeForge AI building a feature for a web project.

Current project files:
${fileContext}

User request: ${args.prompt}

Plan what files to create or modify. Return ONLY a JSON object (no markdown):
{
  "steps": [
    { "action": "create_file" | "edit_file", "path": "filename.ext", "description": "what to do" }
  ],
  "summary": "One-line summary of what you'll build"
}`;

      const planResult = await callAI(planPrompt);
      const planMatch = planResult.match(/\{[\s\S]*\}/);
      if (!planMatch) throw new Error("Failed to generate build plan");

      const plan = JSON.parse(planMatch[0]) as {
        steps: Array<{ action: string; path: string; description: string }>;
        summary: string;
      };

      // Step 2+: Execute each step
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];

        await ctx.runMutation(api.buildLoop.addStep, {
          buildSessionId,
          projectId: args.projectId,
          stepNumber: i + 2,
          action: step.action,
          description: `${step.action === "create_file" ? "Creating" : "Editing"} ${step.path}: ${step.description}`,
          filesChanged: [step.path],
          status: "running",
        });

        // Ask AI to generate the code
        const existingFile = files.find((f) => f.path === step.path);
        const codePrompt = step.action === "edit_file" && existingFile
          ? `Edit this file (${step.path}) to: ${step.description}

Current content:
\`\`\`
${existingFile.content}
\`\`\`

Other project files for context:
${files.filter((f) => f.path !== step.path && !f.isDirectory).map((f) => `--- ${f.path} ---\n${f.content.slice(0, 300)}`).join("\n")}

Return ONLY the complete updated file content. No markdown fences, no explanation — just the raw code.`
          : `Create a new file at ${step.path}: ${step.description}

Other project files for context:
${files.filter((f) => !f.isDirectory).map((f) => `--- ${f.path} ---\n${f.content.slice(0, 300)}`).join("\n")}

Return ONLY the file content. No markdown fences, no explanation — just the raw code.`;

        const code = await callAI(codePrompt);

        // Strip any code fences the AI might have added
        const cleanCode = code.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();

        // Write to files
        if (existingFile) {
          await ctx.runMutation(api.files.updateContent, {
            fileId: existingFile._id,
            content: cleanCode,
          });
        } else {
          const name = step.path.split("/").pop() ?? step.path;
          await ctx.runMutation(api.files.create, {
            projectId: args.projectId,
            path: step.path,
            name,
            isDirectory: false,
          });
          // Get the newly created file and update its content
          const newFiles = await ctx.runQuery(api.files.listByProject, {
            projectId: args.projectId,
          });
          const newFile = newFiles.find((f) => f.path === step.path);
          if (newFile) {
            await ctx.runMutation(api.files.updateContent, {
              fileId: newFile._id,
              content: cleanCode,
            });
          }
        }
      }

      // Mark complete
      await ctx.runMutation(api.buildLoop.finishSession, {
        buildSessionId,
        status: "completed",
      });

      if (args.suggestionId) {
        await ctx.runMutation(api.suggestions.updateStatus, {
          suggestionId: args.suggestionId,
          status: "done",
        });
      }

      return plan.summary;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(api.buildLoop.finishSession, {
        buildSessionId,
        status: "error",
      });
      return `Build failed: ${errMsg}`;
    }
  },
});

async function callAI(prompt: string): Promise<string> {
  const response = await fetch(
    `${VIKTOR_API_URL}/api/viktor-spaces/tools/call`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_name: PROJECT_NAME,
        project_secret: PROJECT_SECRET,
        role: "quick_ai_search",
        arguments: { search_question: prompt },
      }),
    }
  );

  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  const json = await response.json();
  if (!json.success) throw new Error(json.error ?? "AI call failed");
  return json.result.search_response;
}
