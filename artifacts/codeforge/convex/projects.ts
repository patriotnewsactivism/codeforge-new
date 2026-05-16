import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      ownerId: v.id("users"),
      githubRepo: v.optional(v.string()),
      githubToken: v.optional(v.string()),
      language: v.optional(v.string()),
      lastOpenedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      ownerId: v.id("users"),
      githubRepo: v.optional(v.string()),
      githubToken: v.optional(v.string()),
      language: v.optional(v.string()),
      lastOpenedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    // Check access: owner or collaborator
    if (project.ownerId !== userId) {
      const collab = await ctx.db
        .query("collaborators")
        .withIndex("by_project_and_user", (q) =>
          q.eq("projectId", args.projectId).eq("userId", userId)
        )
        .unique();
      if (!collab) return null;
    }
    return project;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    githubRepo: v.optional(v.string()),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      githubRepo: args.githubRepo,
      ownerId: userId,
      lastOpenedAt: Date.now(),
    });
    // Create default starter files
    await ctx.db.insert("files", {
      projectId,
      path: "index.html",
      name: "index.html",
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Hello, CodeForge!</h1>
  <p>Start editing to see your changes live.</p>
  <script src="script.js"></script>
</body>
</html>`,
      language: "html",
      isDirectory: false,
    });
    await ctx.db.insert("files", {
      projectId,
      path: "style.css",
      name: "style.css",
      content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a2e;
  color: #eee;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  text-align: center;
}

h1 {
  font-size: 2.5rem;
  background: linear-gradient(135deg, #00d4ff, #7b2ff7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 1rem;
}

p {
  font-size: 1.2rem;
  color: #888;
}`,
      language: "css",
      isDirectory: false,
    });
    await ctx.db.insert("files", {
      projectId,
      path: "script.js",
      name: "script.js",
      content: `// Your JavaScript goes here
console.log("CodeForge project loaded!");

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM ready");
});`,
      language: "javascript",
      isDirectory: false,
    });
    return projectId;
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const project = await ctx.db.get(args.projectId);
    if (!project || project.ownerId !== userId) throw new Error("Not authorized");

    // Delete all files
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const file of files) {
      await ctx.db.delete(file._id);
    }

    // Delete all chat sessions and messages
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const session of sessions) {
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const msg of messages) {
        await ctx.db.delete(msg._id);
      }
      await ctx.db.delete(session._id);
    }

    // Delete collaborators
    const collabs = await ctx.db
      .query("collaborators")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const c of collabs) {
      await ctx.db.delete(c._id);
    }

    await ctx.db.delete(args.projectId);
    return null;
  },
});

export const updateLastOpened = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(args.projectId, { lastOpenedAt: Date.now() });
    return null;
  },
});

export const setGithubRepo = mutation({
  args: {
    projectId: v.id("projects"),
    githubRepo: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(args.projectId, { githubRepo: args.githubRepo });
    return null;
  },
});
