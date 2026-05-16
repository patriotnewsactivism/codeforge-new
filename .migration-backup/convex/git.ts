import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

declare const process: { env: Record<string, string | undefined> };

// const VIKTOR_API_URL = process.env.VIKTOR_SPACES_API_URL!;
// const PROJECT_NAME = process.env.VIKTOR_SPACES_PROJECT_NAME!;
// const PROJECT_SECRET = process.env.VIKTOR_SPACES_PROJECT_SECRET!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface GitHubFile {
  path: string;
  mode: "100644" | "100755" | "040000";
  type: "blob" | "tree";
  sha?: string;
  content?: string;
}

// ─── QUERIES ─────────────────────────────────────────────────────────────────

export const listCommits = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gitCommits")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(30);
  },
});

export const listBranches = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gitBranches")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getActiveBranch = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const branches = await ctx.db
      .query("gitBranches")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return branches.find((b) => b.isActive) ?? null;
  },
});

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

export const recordCommit = mutation({
  args: {
    projectId: v.id("projects"),
    sha: v.string(),
    message: v.string(),
    branch: v.string(),
    filesChanged: v.array(v.string()),
    agentId: v.optional(v.string()),
    buildSessionId: v.optional(v.id("buildSessions")),
  },
  returns: v.id("gitCommits"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("gitCommits", {
      ...args,
      timestamp: Date.now(),
      pushedAt: Date.now(),
    });
  },
});

export const upsertBranch = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    isActive: v.boolean(),
    headSha: v.optional(v.string()),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    status: v.union(
      v.literal("open"),
      v.literal("merged"),
      v.literal("closed"),
      v.literal("local")
    ),
  },
  returns: v.id("gitBranches"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("gitBranches")
      .withIndex("by_project_and_name", (q) =>
        q.eq("projectId", args.projectId).eq("name", args.name)
      )
      .first();

    if (args.isActive) {
      // Deactivate all other branches for this project
      const others = await ctx.db
        .query("gitBranches")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
      for (const b of others) {
        if (b._id !== existing?._id) {
          await ctx.db.patch(b._id, { isActive: false });
        }
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        isActive: args.isActive,
        headSha: args.headSha ?? existing.headSha,
        prUrl: args.prUrl ?? existing.prUrl,
        prNumber: args.prNumber ?? existing.prNumber,
        status: args.status,
      });
      return existing._id;
    }

    return await ctx.db.insert("gitBranches", {
      projectId: args.projectId,
      name: args.name,
      isActive: args.isActive,
      headSha: args.headSha,
      prUrl: args.prUrl,
      prNumber: args.prNumber,
      status: args.status,
      createdAt: Date.now(),
    });
  },
});

// ─── ACTIONS ─────────────────────────────────────────────────────────────────

// Push all project files to GitHub, creating a branch for this task
export const pushToGitHub = action({
  args: {
    projectId: v.id("projects"),
    repoFullName: v.string(),    // "owner/repo"
    branchName: v.string(),      // e.g. "agent/add-auth-modal"
    commitMessage: v.string(),
    agentId: v.optional(v.string()),
    buildSessionId: v.optional(v.id("buildSessions")),
    createPR: v.optional(v.boolean()),
    prTitle: v.optional(v.string()),
    prBody: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    branchUrl: v.optional(v.string()),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    commitSha: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    if (!GITHUB_TOKEN) {
      return { success: false, error: "GITHUB_TOKEN not configured. Add it in project settings." };
    }

    const ghHeaders = {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "CodeForge-Agent",
    };

    const apiBase = `https://api.github.com/repos/${args.repoFullName}`;

    try {
      // 1. Get files from project
      const files = await ctx.runQuery(api.files.listByProject, {
        projectId: args.projectId,
      });
      const codeFiles = files.filter((f: any) => !f.isDirectory);

      // 2. Get default branch SHA
      const repoRes = await fetch(apiBase, { headers: ghHeaders });
      const repoData = await repoRes.json() as { default_branch: string };
      const defaultBranch = repoData.default_branch ?? "main";

      const refRes = await fetch(`${apiBase}/git/refs/heads/${defaultBranch}`, { headers: ghHeaders });
      const refData = await refRes.json() as { object: { sha: string } };
      const baseSha = refData.object?.sha;
      if (!baseSha) throw new Error(`Could not get SHA for ${defaultBranch}`);

      // 3. Create blobs for each file
      const treeItems: GitHubFile[] = [];
      for (const file of codeFiles) {
        const blobRes = await fetch(`${apiBase}/git/blobs`, {
          method: "POST",
          headers: ghHeaders,
          body: JSON.stringify({ content: file.content, encoding: "utf-8" }),
        });
        const blob = await blobRes.json() as { sha: string };
        treeItems.push({
          path: file.path,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        });
      }

      // 4. Create tree
      const treeRes = await fetch(`${apiBase}/git/trees`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({ base_tree: baseSha, tree: treeItems }),
      });
      const treeData = await treeRes.json() as { sha: string };

      // 5. Create commit
      const commitRes = await fetch(`${apiBase}/git/commits`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          message: args.commitMessage,
          tree: treeData.sha,
          parents: [baseSha],
          author: {
            name: "CodeForge Agent",
            email: "agent@codeforge.ai",
            date: new Date().toISOString(),
          },
        }),
      });
      const commitData = await commitRes.json() as { sha: string };
      const commitSha = commitData.sha;

      // 6. Create or update branch
      const branchCheckRes = await fetch(`${apiBase}/git/refs/heads/${args.branchName}`, { headers: ghHeaders });
      const branchExists = branchCheckRes.ok;

      if (branchExists) {
        await fetch(`${apiBase}/git/refs/heads/${args.branchName}`, {
          method: "PATCH",
          headers: ghHeaders,
          body: JSON.stringify({ sha: commitSha, force: false }),
        });
      } else {
        await fetch(`${apiBase}/git/refs`, {
          method: "POST",
          headers: ghHeaders,
          body: JSON.stringify({ ref: `refs/heads/${args.branchName}`, sha: commitSha }),
        });
      }

      const branchUrl = `https://github.com/${args.repoFullName}/tree/${args.branchName}`;

      // 7. Optionally create PR
      let prUrl: string | undefined;
      let prNumber: number | undefined;

      if (args.createPR) {
        const prRes = await fetch(`${apiBase}/pulls`, {
          method: "POST",
          headers: ghHeaders,
          body: JSON.stringify({
            title: args.prTitle ?? args.commitMessage,
            body: args.prBody ?? `Automated changes by CodeForge Agent\n\nCommit: ${commitSha}`,
            head: args.branchName,
            base: defaultBranch,
          }),
        });
        const prData = await prRes.json() as { html_url?: string; number?: number; errors?: unknown };
        if (prData.html_url) {
          prUrl = prData.html_url;
          prNumber = prData.number;
        }
      }

      // 8. Record in DB
      const changedPaths = codeFiles.map((f: any) => f.path);
      await ctx.runMutation(api.git.recordCommit, {
        projectId: args.projectId,
        sha: commitSha,
        message: args.commitMessage,
        branch: args.branchName,
        filesChanged: changedPaths,
        agentId: args.agentId,
        buildSessionId: args.buildSessionId,
      });

      await ctx.runMutation(api.git.upsertBranch, {
        projectId: args.projectId,
        name: args.branchName,
        isActive: true,
        headSha: commitSha,
        prUrl,
        prNumber,
        status: prUrl ? "open" : "local",
      });

      return { success: true, branchUrl, prUrl, prNumber, commitSha };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
});

// Import a GitHub repo into a CodeForge project
export const importFromGitHub = action({
  args: {
    projectId: v.id("projects"),
    repoFullName: v.string(),
    branch: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    filesImported: v.number(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    if (!GITHUB_TOKEN) {
      return { success: false, filesImported: 0, error: "GITHUB_TOKEN not configured" };
    }

    const ghHeaders = {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "CodeForge-Agent",
    };

    try {
      const apiBase = `https://api.github.com/repos/${args.repoFullName}`;

      // Get default branch if not specified
      let branch = args.branch;
      if (!branch) {
        const repoRes = await fetch(apiBase, { headers: ghHeaders });
        const repoData = await repoRes.json() as { default_branch: string };
        branch = repoData.default_branch ?? "main";
      }

      // Get tree recursively
      const treeRes = await fetch(`${apiBase}/git/trees/${branch}?recursive=1`, { headers: ghHeaders });
      const treeData = await treeRes.json() as { tree: Array<{ path: string; type: string; url: string; size?: number }> };

      const CODE_EXTENSIONS = [
        ".ts", ".tsx", ".js", ".jsx", ".css", ".scss", ".html", ".json",
        ".md", ".mdx", ".py", ".go", ".rs", ".toml", ".yaml", ".yml", ".sh",
        ".env.example", ".prisma", ".graphql", ".sql", ".swift", ".kt", ".rb",
        ".php", ".c", ".cpp", ".h", ".vue", ".svelte", ".astro",
      ];

      const codeFiles = treeData.tree.filter(
        (f) => f.type === "blob" &&
          (f.size ?? 0) < 100_000 &&
          CODE_EXTENSIONS.some((ext) => f.path.endsWith(ext)) &&
          !f.path.includes("node_modules") &&
          !f.path.includes(".git")
      );

      let imported = 0;
      for (const file of codeFiles.slice(0, 250)) {
        const contentRes = await fetch(file.url, { headers: ghHeaders });
        const contentData = await contentRes.json() as { content: string; encoding: string };
        let content = "";
        if (contentData.encoding === "base64") {
          content = atob(contentData.content.replace(/\n/g, ""));
        } else {
          content = contentData.content;
        }

        const parts = file.path.split("/");
        const name = parts[parts.length - 1];

        const existing = await ctx.runQuery(api.files.getByPath, {
          projectId: args.projectId,
          path: file.path,
        });

        if (existing) {
          await ctx.runMutation(api.files.updateContent, { fileId: existing._id, content });
        } else {
          await ctx.runMutation(api.files.create, {
            projectId: args.projectId,
            path: file.path,
            name,
            content,
            isDirectory: false,
            parentPath: parts.slice(0, -1).join("/") || undefined,
          });
        }
        imported++;
      }

      // Store the github repo reference on the project
      try {
        await ctx.runMutation(api.projects.setGithubRepo, {
          projectId: args.projectId,
          githubRepo: args.repoFullName,
        });
      } catch (_) {
        // non-fatal — project was created successfully
      }

      return { success: true, filesImported: imported };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, filesImported: 0, error: msg };
    }
  },
});
