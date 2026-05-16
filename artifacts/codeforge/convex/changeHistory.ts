import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Change History (undo/rollback for suggestions & build steps) ───

export const listByProject = query({
  args: { projectId: v.id("projects"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const changes = await ctx.db
      .query("changeHistory")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
    return args.limit ? changes.slice(0, args.limit) : changes;
  },
});

export const listBySuggestion = query({
  args: { suggestionId: v.id("suggestions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("changeHistory")
      .withIndex("by_suggestion", (q) => q.eq("suggestionId", args.suggestionId))
      .collect();
  },
});

export const recordChange = mutation({
  args: {
    projectId: v.id("projects"),
    suggestionId: v.optional(v.id("suggestions")),
    buildStepId: v.optional(v.id("buildSteps")),
    filePath: v.string(),
    previousContent: v.string(),
    newContent: v.string(),
    action: v.union(v.literal("create"), v.literal("edit"), v.literal("delete")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("changeHistory", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const undoChange = mutation({
  args: { changeId: v.id("changeHistory") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const change = await ctx.db.get(args.changeId);
    if (!change) throw new Error("Change not found");
    if (change.undone) throw new Error("Already undone");

    // Restore the file to its previous state
    const files = await ctx.db
      .query("files")
      .withIndex("by_project_and_path", (q) =>
        q.eq("projectId", change.projectId).eq("path", change.filePath)
      )
      .collect();

    if (change.action === "create") {
      // Undo a create = delete the file
      const file = files[0];
      if (file) await ctx.db.delete(file._id);
    } else if (change.action === "delete") {
      // Undo a delete = recreate the file
      const name = change.filePath.split("/").pop() ?? change.filePath;
      const parentPath = change.filePath.includes("/")
        ? change.filePath.substring(0, change.filePath.lastIndexOf("/"))
        : undefined;
      await ctx.db.insert("files", {
        projectId: change.projectId,
        path: change.filePath,
        name,
        content: change.previousContent,
        isDirectory: false,
        parentPath,
      });
    } else {
      // Undo an edit = restore previous content
      const file = files[0];
      if (file) {
        await ctx.db.patch(file._id, { content: change.previousContent });
      }
    }

    // Mark as undone
    await ctx.db.patch(args.changeId, { undone: true });
    return null;
  },
});

// Undo all changes from a specific suggestion
export const undoSuggestion = mutation({
  args: { suggestionId: v.id("suggestions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const changes = await ctx.db
      .query("changeHistory")
      .withIndex("by_suggestion", (q) => q.eq("suggestionId", args.suggestionId))
      .order("desc")
      .collect();

    for (const change of changes) {
      if (change.undone) continue;

      const files = await ctx.db
        .query("files")
        .withIndex("by_project_and_path", (q) =>
          q.eq("projectId", change.projectId).eq("path", change.filePath)
        )
        .collect();

      if (change.action === "create") {
        const file = files[0];
        if (file) await ctx.db.delete(file._id);
      } else if (change.action === "delete") {
        const name = change.filePath.split("/").pop() ?? change.filePath;
        await ctx.db.insert("files", {
          projectId: change.projectId,
          path: change.filePath,
          name,
          content: change.previousContent,
          isDirectory: false,
        });
      } else {
        const file = files[0];
        if (file) await ctx.db.patch(file._id, { content: change.previousContent });
      }

      await ctx.db.patch(change._id, { undone: true });
    }

    // Revert suggestion status
    await ctx.db.patch(args.suggestionId, { status: "pending" });
    return null;
  },
});
