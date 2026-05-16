import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

// GitHub API helper
async function githubFetch(
  path: string,
  token: string,
  options?: RequestInit
): Promise<Response> {
  const url = path.startsWith("http")
    ? path
    : `https://api.github.com${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      ...((options?.headers as Record<string, string>) || {}),
    },
  });
}

// Save GitHub token
export const saveToken = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("githubSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { token });
    } else {
      await ctx.db.insert("githubSettings", { userId, token });
    }
    return null;
  },
});

// Get GitHub connection status
export const getSettings = query({
  args: {},
  returns: v.union(
    v.object({
      connected: v.boolean(),
      username: v.optional(v.string()),
      avatarUrl: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const settings = await ctx.db
      .query("githubSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!settings) return { connected: false };
    return {
      connected: true,
      username: settings.username,
      avatarUrl: settings.avatarUrl,
    };
  },
});

// Validate token and fetch user info
export const validateToken = action({
  args: { token: v.string() },
  returns: v.object({
    valid: v.boolean(),
    username: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { token }) => {
    try {
      const response = await githubFetch("/user", token);
      if (!response.ok) {
        return {
          valid: false,
          error: `GitHub API error: ${response.status}`,
        };
      }
      const data = (await response.json()) as {
        login: string;
        avatar_url: string;
      };

      // Save to DB via mutation
      await ctx.runMutation(api.github.saveToken, { token });
      await ctx.runMutation(api.github.updateProfile, {
        username: data.login,
        avatarUrl: data.avatar_url,
      });

      return {
        valid: true,
        username: data.login,
        avatarUrl: data.avatar_url,
      };
    } catch (e) {
      return {
        valid: false,
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  },
});

export const updateProfile = mutation({
  args: { username: v.string(), avatarUrl: v.string() },
  returns: v.null(),
  handler: async (ctx, { username, avatarUrl }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const settings = await ctx.db
      .query("githubSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (settings) {
      await ctx.db.patch(settings._id, { username, avatarUrl });
    }
    return null;
  },
});

// List user's repos
export const listRepos = action({
  args: { page: v.optional(v.number()) },
  returns: v.array(
    v.object({
      fullName: v.string(),
      name: v.string(),
      description: v.union(v.string(), v.null()),
      language: v.union(v.string(), v.null()),
      updatedAt: v.string(),
      isPrivate: v.boolean(),
      defaultBranch: v.string(),
      stars: v.number(),
      size: v.number(),
    })
  ),
  handler: async (ctx, { page }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const settings = await ctx.runQuery(api.github.getTokenInternal, {});
    if (!settings?.token) throw new Error("GitHub not connected");

    const response = await githubFetch(
      `/user/repos?sort=updated&per_page=30&page=${page || 1}&type=all`,
      settings.token
    );
    if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);

    type GHRepo = {
      full_name: string;
      name: string;
      description: string | null;
      language: string | null;
      updated_at: string;
      private: boolean;
      default_branch: string;
      stargazers_count: number;
      size: number;
    };
    const repos = (await response.json()) as GHRepo[];
    return repos.map((r) => ({
      fullName: r.full_name,
      name: r.name,
      description: r.description,
      language: r.language,
      updatedAt: r.updated_at,
      isPrivate: r.private,
      defaultBranch: r.default_branch,
      stars: r.stargazers_count,
      size: r.size,
    }));
  },
});

// Internal query to get token (used by actions)
export const getTokenInternal = query({
  args: {},
  returns: v.union(v.object({ token: v.string() }), v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const settings = await ctx.db
      .query("githubSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!settings) return null;
    return { token: settings.token };
  },
});

// Import a repo's file tree
export const importRepo = action({
  args: {
    projectId: v.id("projects"),
    repo: v.string(), // "owner/repo"
    branch: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    fileCount: v.number(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { projectId, repo, branch }) => {
    const settings = await ctx.runQuery(api.github.getTokenInternal, {});
    if (!settings?.token)
      return { success: false, fileCount: 0, error: "GitHub not connected" };

    const ref = branch || "main";

    try {
      // Get the tree recursively
      const response = await githubFetch(
        `/repos/${repo}/git/trees/${ref}?recursive=1`,
        settings.token
      );
      if (!response.ok) {
        const text = await response.text();
        return {
          success: false,
          fileCount: 0,
          error: `Failed to fetch repo tree: ${text}`,
        };
      }

      type TreeItem = {
        path: string;
        type: string;
        sha: string;
        size?: number;
      };
      const data = (await response.json()) as {
        tree: TreeItem[];
        truncated: boolean;
      };

      // Filter out large files, binary files, node_modules, etc.
      const skipPatterns = [
        /node_modules\//,
        /\.git\//,
        /dist\//,
        /build\//,
        /\.next\//,
        /\.cache\//,
        /package-lock\.json$/,
        /yarn\.lock$/,
        /bun\.lockb$/,
        /\.woff2?$/,
        /\.ttf$/,
        /\.eot$/,
        /\.ico$/,
        /\.png$/,
        /\.jpg$/,
        /\.jpeg$/,
        /\.gif$/,
        /\.svg$/,
        /\.mp[34]$/,
        /\.webp$/,
        /\.pdf$/,
        /\.zip$/,
        /\.tar$/,
        /\.gz$/,
      ];

      const MAX_FILE_SIZE = 100_000; // 100KB max per file
      const MAX_FILES = 200; // Limit total files

      const filteredTree = data.tree
        .filter((item) => {
          if (skipPatterns.some((p) => p.test(item.path))) return false;
          if (item.type === "blob" && (item.size || 0) > MAX_FILE_SIZE)
            return false;
          return true;
        })
        .slice(0, MAX_FILES);

      // Collect folders
      const folders = new Set<string>();
      for (const item of filteredTree) {
        if (item.type === "tree") {
          folders.add(item.path);
        } else {
          // Add parent folders
          const parts = item.path.split("/");
          for (let i = 1; i < parts.length; i++) {
            folders.add(parts.slice(0, i).join("/"));
          }
        }
      }

      // Batch: insert folders first
      const folderFiles = Array.from(folders)
        .sort()
        .map((p) => ({
          path: p,
          name: p.split("/").pop() || p,
          type: "folder" as const,
        }));

      if (folderFiles.length > 0) {
        await ctx.runMutation(api.files.bulkInsert, {
          projectId,
          files: folderFiles,
        });
      }

      // Fetch file contents in batches
      const blobs = filteredTree.filter((item) => item.type === "blob");
      const BATCH_SIZE = 15;
      let totalFiles = folderFiles.length;

      for (let i = 0; i < blobs.length; i += BATCH_SIZE) {
        const batch = blobs.slice(i, i + BATCH_SIZE);
        const fileData = await Promise.all(
          batch.map(async (item) => {
            try {
              const fileResp = await githubFetch(
                `/repos/${repo}/contents/${item.path}?ref=${ref}`,
                settings.token
              );
              if (!fileResp.ok) return null;
              const fileJson = (await fileResp.json()) as {
                content?: string;
                sha: string;
              };
              let content = "";
              if (fileJson.content) {
                content = atob(fileJson.content.replace(/\n/g, ""));
              }
              return {
                path: item.path,
                name: item.path.split("/").pop() || item.path,
                type: "file" as const,
                content,
                size: content.length,
                // sha tracked server-side if needed
              };
            } catch {
              return null;
            }
          })
        );

        const validFiles = fileData.filter(
          (f): f is NonNullable<typeof f> => f !== null
        );
        if (validFiles.length > 0) {
          await ctx.runMutation(api.files.bulkInsert, {
            projectId,
            files: validFiles,
          });
          totalFiles += validFiles.length;
        }
      }

      return { success: true, fileCount: totalFiles };
    } catch (e) {
      return {
        success: false,
        fileCount: 0,
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  },
});

// Commit a file back to GitHub
export const commitFile = action({
  args: {
    repo: v.string(),
    path: v.string(),
    content: v.string(),
    message: v.string(),
    branch: v.optional(v.string()),
    sha: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { repo, path, content, message, branch, sha }) => {
    const settings = await ctx.runQuery(api.github.getTokenInternal, {});
    if (!settings?.token)
      return { success: false, error: "GitHub not connected" };

    try {
      // If no SHA provided, try to get the current file to get its SHA
      let fileSha = sha;
      if (!fileSha) {
        const existingResp = await githubFetch(
          `/repos/${repo}/contents/${path}?ref=${branch || "main"}`,
          settings.token
        );
        if (existingResp.ok) {
          const existing = (await existingResp.json()) as { sha: string };
          fileSha = existing.sha;
        }
      }

      const response = await githubFetch(
        `/repos/${repo}/contents/${path}`,
        settings.token,
        {
          method: "PUT",
          body: JSON.stringify({
            message,
            content: btoa(content),
            branch: branch || "main",
            ...(fileSha ? { sha: fileSha } : {}),
          }),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `GitHub API error: ${text}` };
      }

      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  },
});

// ─── Create a branch (for branch-per-mission) ──────────────────
export const createBranch = action({
  args: {
    repo: v.string(),
    branchName: v.string(),
    fromBranch: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { repo, branchName, fromBranch }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { success: false, error: "Not authenticated" };

    const settings = await ctx.runQuery(api.github.getTokenInternal, {});
    if (!settings?.token) return { success: false, error: "No GitHub token" };

    try {
      // Get the SHA of the source branch
      const srcBranch = fromBranch || "main";
      const refResp = await githubFetch(
        `/repos/${repo}/git/ref/heads/${srcBranch}`,
        settings.token
      );
      if (!refResp.ok) {
        return { success: false, error: `Source branch '${srcBranch}' not found` };
      }
      const refData = (await refResp.json()) as { object: { sha: string } };
      const sha = refData.object.sha;

      // Create the new branch
      const createResp = await githubFetch(
        `/repos/${repo}/git/refs`,
        settings.token,
        {
          method: "POST",
          body: JSON.stringify({
            ref: `refs/heads/${branchName}`,
            sha,
          }),
        }
      );

      if (!createResp.ok) {
        const text = await createResp.text();
        if (text.includes("Reference already exists")) {
          return { success: true }; // Branch already exists, that's fine
        }
        return { success: false, error: `Failed to create branch: ${text}` };
      }

      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  },
});

// ─── Create Pull Request ────────────────────────────────────────
export const createPullRequest = action({
  args: {
    repo: v.string(),
    title: v.string(),
    body: v.optional(v.string()),
    head: v.string(), // branch name
    base: v.optional(v.string()), // defaults to "main"
  },
  returns: v.object({
    success: v.boolean(),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { repo, title, body, head, base }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { success: false, error: "Not authenticated" };

    const settings = await ctx.runQuery(api.github.getTokenInternal, {});
    if (!settings?.token) return { success: false, error: "No GitHub token" };

    try {
      const resp = await githubFetch(`/repos/${repo}/pulls`, settings.token, {
        method: "POST",
        body: JSON.stringify({
          title,
          body: body || "",
          head,
          base: base || "main",
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        return { success: false, error: `PR creation failed: ${text}` };
      }

      const pr = (await resp.json()) as { html_url: string; number: number };
      return {
        success: true,
        prUrl: pr.html_url,
        prNumber: pr.number,
      };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  },
});
