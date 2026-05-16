import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("files"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      path: v.string(),
      name: v.string(),
      content: v.string(),
      language: v.optional(v.string()),
      isDirectory: v.boolean(),
      parentPath: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getByPath = query({
  args: { projectId: v.id("projects"), path: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("files"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      path: v.string(),
      name: v.string(),
      content: v.string(),
      language: v.optional(v.string()),
      isDirectory: v.boolean(),
      parentPath: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("files")
      .withIndex("by_project_and_path", (q) =>
        q.eq("projectId", args.projectId).eq("path", args.path)
      )
      .unique();
  },
});

export const updateContent = mutation({
  args: {
    fileId: v.id("files"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(args.fileId, { content: args.content });
    return null;
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    path: v.string(),
    name: v.string(),
    content: v.optional(v.string()),
    isDirectory: v.boolean(),
    language: v.optional(v.string()),
    parentPath: v.optional(v.string()),
  },
  returns: v.id("files"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if file already exists
    const existing = await ctx.db
      .query("files")
      .withIndex("by_project_and_path", (q) =>
        q.eq("projectId", args.projectId).eq("path", args.path)
      )
      .unique();
    if (existing) throw new Error("File already exists at this path");

    return await ctx.db.insert("files", {
      projectId: args.projectId,
      path: args.path,
      name: args.name,
      content: args.content ?? "",
      isDirectory: args.isDirectory,
      language: args.language ?? detectLanguage(args.name),
      parentPath: args.parentPath,
    });
  },
});

export const rename = mutation({
  args: {
    fileId: v.id("files"),
    newName: v.string(),
    newPath: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(args.fileId, {
      name: args.newName,
      path: args.newPath,
    });
    return null;
  },
});

export const remove = mutation({
  args: { fileId: v.id("files") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.delete(args.fileId);
    return null;
  },
});

// Alias used by agents and git importer
export const update = mutation({
  args: {
    fileId: v.id("files"),
    content: v.string(),
    language: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { content: args.content };
    if (args.language) patch.language = args.language;
    await ctx.db.patch(args.fileId, patch);
    return null;
  },
});

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    html: "html",
    htm: "html",
    css: "css",
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    md: "markdown",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    cpp: "cpp",
    c: "c",
    h: "c",
    php: "php",
    sql: "sql",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    svg: "xml",
    sh: "shell",
    bash: "shell",
    txt: "plaintext",
  };
  return langMap[ext ?? ""] ?? "plaintext";
}

// ─── Bulk insert (used by GitHub import) ────────────────────────
export const bulkInsert = mutation({
  args: {
    projectId: v.id("projects"),
    files: v.array(v.object({
      path: v.string(),
      name: v.string(),
      type: v.union(v.literal("file"), v.literal("folder")),
      content: v.optional(v.string()),
      language: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { projectId, files }) => {
    const { getAuthUserId } = await import("@convex-dev/auth/server");
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    let count = 0;
    for (const f of files) {
      const existing = await ctx.db
        .query("files")
        .withIndex("by_project_and_path", (q) =>
          q.eq("projectId", projectId).eq("path", f.path)
        )
        .first();

      const isDirectory = f.type === "folder";

      if (existing) {
        await ctx.db.patch(existing._id, {
          content: f.content ?? "",
          language: f.language,
        });
      } else {
        await ctx.db.insert("files", {
          projectId,
          path: f.path,
          name: f.name,
          content: f.content ?? "",
          language: f.language,
          isDirectory,
          parentPath: f.path.includes("/")
            ? f.path.split("/").slice(0, -1).join("/")
            : undefined,
        });
      }
      count++;
    }
    return { inserted: count };
  },
});
