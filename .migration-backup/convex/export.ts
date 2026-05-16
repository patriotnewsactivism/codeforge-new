import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Export all project files as a JSON bundle (frontend converts to zip)
export const getProjectBundle = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return {
      name: project.name,
      description: project.description,
      files: files
        .filter((f) => !f.isDirectory)
        .map((f) => ({
          path: f.path,
          content: f.content,
          language: f.language,
        })),
    };
  },
});
