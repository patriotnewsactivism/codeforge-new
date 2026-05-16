import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

declare const process: { env: Record<string, string | undefined> };

// const VIKTOR_API_URL = process.env.VIKTOR_SPACES_API_URL!;
// const PROJECT_NAME = process.env.VIKTOR_SPACES_PROJECT_NAME!;
// const PROJECT_SECRET = process.env.VIKTOR_SPACES_PROJECT_SECRET!;

// ── Simple TF-IDF style embedding stored as JSON string ─────────────────────
// Real vector search would use an external embedding API. This implementation
// uses keyword indexing with TF-IDF scoring — works without external deps.

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "are", "was",
  "will", "can", "has", "have", "been", "not", "but", "all", "its",
  "they", "their", "them", "use", "used", "using", "function", "return",
  "const", "let", "var", "type", "import", "export", "default", "class",
]);

function buildTermFrequency(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const t of tokens) {
    tf[t] = (tf[t] ?? 0) + 1;
  }
  // Normalize
  const total = tokens.length || 1;
  for (const k of Object.keys(tf)) {
    tf[k] = tf[k]! / total;
  }
  return tf;
}

function cosineSimilarity(
  a: Record<string, number>,
  b: Record<string, number>
): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [k, v] of Object.entries(a)) {
    dot += v * (b[k] ?? 0);
    normA += v * v;
  }
  for (const v of Object.values(b)) {
    normB += v * v;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── QUERIES ─────────────────────────────────────────────────────────────────

export const listIndexedFiles = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("codebaseIndex")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getIndexStats = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("codebaseIndex")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return {
      totalFiles: entries.length,
      lastIndexedAt: entries.reduce((max, e) => Math.max(max, e.indexedAt), 0),
    };
  },
});

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

export const indexFile = mutation({
  args: {
    projectId: v.id("projects"),
    fileId: v.id("files"),
    path: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const tokens = tokenize(args.content);
    const tf = buildTermFrequency(tokens);

    // Extract semantic tags: function names, imports, class names
    const fnMatches = args.content.match(/(?:function|const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g) ?? [];
    const importMatches = args.content.match(/from\s+['"]([^'"]+)['"]/g) ?? [];
    const tags = [
      ...fnMatches.map((m) => m.split(/\s+/).pop() ?? ""),
      ...importMatches.map((m) => m.replace(/from\s+['"]/, "").replace(/['"]/, "")),
    ].filter(Boolean);

    // Detect language from extension
    const ext = args.path.split(".").pop() ?? "";
    const langMap: Record<string, string> = {
      ts: "typescript", tsx: "typescript-react", js: "javascript",
      jsx: "javascript-react", css: "css", html: "html",
      py: "python", go: "go", rs: "rust", md: "markdown",
    };
    const language = langMap[ext] ?? ext;

    const existing = await ctx.db
      .query("codebaseIndex")
      .withIndex("by_project_and_path", (q) =>
        q.eq("projectId", args.projectId).eq("path", args.path)
      )
      .first();

    const record = {
      projectId: args.projectId,
      fileId: args.fileId,
      path: args.path,
      language,
      termFrequency: JSON.stringify(tf),
      tags,
      tokenCount: tokens.length,
      indexedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, record);
    } else {
      await ctx.db.insert("codebaseIndex", record);
    }
  },
});

export const removeFromIndex = mutation({
  args: { projectId: v.id("projects"), path: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("codebaseIndex")
      .withIndex("by_project_and_path", (q) =>
        q.eq("projectId", args.projectId).eq("path", args.path)
      )
      .first();
    if (entry) await ctx.db.delete(entry._id);
  },
});

// ─── ACTIONS ─────────────────────────────────────────────────────────────────

// Index all files in a project
export const indexProject = action({
  args: { projectId: v.id("projects") },
  returns: v.object({ filesIndexed: v.number() }),
  handler: async (ctx, args): Promise<{ filesIndexed: number }> => {
    const files: any[] = await ctx.runQuery(api.files.listByProject, {
      projectId: args.projectId,
    });
    const codeFiles = files.filter((f: any) => !f.isDirectory && f.content.length > 0);

    for (const file of codeFiles) {
      await ctx.runMutation(api.rag.indexFile, {
        projectId: args.projectId,
        fileId: file._id,
        path: file.path,
        content: file.content,
      });
    }

    return { filesIndexed: codeFiles.length };
  },
});

// Semantic search: find the most relevant files for a query
export const search = action({
  args: {
    projectId: v.id("projects"),
    query: v.string(),
    topK: v.optional(v.number()),
    filterLanguage: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      path: v.string(),
      language: v.string(),
      score: v.number(),
      tags: v.array(v.string()),
      snippet: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const topK = args.topK ?? 8;
    const queryTokens = tokenize(args.query);
    const queryTF = buildTermFrequency(queryTokens);

    // Also add query terms as-is for exact match bonus
    const queryWords = args.query.toLowerCase().split(/\s+/);

    let entries = await ctx.runQuery(api.rag.listIndexedFiles, {
      projectId: args.projectId,
    });

    if (args.filterLanguage) {
      entries = entries.filter((e: any) => e.language === args.filterLanguage);
    }

    // Score each file
    const scored = entries.map((entry: any) => {
      const fileTF = JSON.parse(entry.termFrequency) as Record<string, number>;
      let score = cosineSimilarity(queryTF, fileTF);

      // Bonus for tag matches (function/class names in query)
      const tagBonus = entry.tags.filter((tag: string) =>
        queryWords.some((w) => tag.toLowerCase().includes(w) || w.includes(tag.toLowerCase()))
      ).length * 0.15;

      score += tagBonus;

      // Bonus for path matching query words
      const pathBonus = queryWords.filter((w) =>
        entry.path.toLowerCase().includes(w)
      ).length * 0.1;

      score += pathBonus;

      return { entry, score };
    });

    // Sort by score, take top K
    scored.sort((a: any, b: any) => b.score - a.score);
    const top = scored.slice(0, topK).filter((s: any) => s.score > 0);

    // Fetch actual file content for snippets
    const results: Array<{
      path: string;
      language: string;
      score: number;
      tags: string[];
      snippet: string;
    }> = [];

    for (const { entry, score } of top) {
      const file = await ctx.runQuery(api.files.getByPath, {
        projectId: args.projectId,
        path: entry.path,
      });

      let snippet = "";
      if (file) {
        // Extract relevant snippet around the first query term match
        const lines = file.content.split("\n");
        const firstMatch = lines.findIndex((line: string) =>
          queryWords.some((w) => line.toLowerCase().includes(w))
        );
        const start = Math.max(0, firstMatch - 2);
        const end = Math.min(lines.length, start + 10);
        snippet = lines.slice(start, end).join("\n");
      }

      results.push({
        path: entry.path,
        language: entry.language,
        score: Math.round(score * 1000) / 1000,
        tags: entry.tags.slice(0, 10),
        snippet,
      });
    }

    return results;
  },
});

// Get context-aware file selection for an agent prompt
export const getContextForPrompt = action({
  args: {
    projectId: v.id("projects"),
    query: v.string(),
    maxTokens: v.optional(v.number()),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const maxTokens = args.maxTokens ?? 8000;

    const results = await ctx.runAction(api.rag.search, {
      projectId: args.projectId,
      query: args.query,
      topK: 10,
    });

    if (results.length === 0) return "";

    const lines: string[] = [
      `=== RELEVANT FILES FOR: "${args.query}" ===`,
    ];

    let charBudget = maxTokens * 4; // ~4 chars per token

    for (const result of results) {
      const file = await ctx.runQuery(api.files.getByPath, {
        projectId: args.projectId,
        path: result.path,
      });
      if (!file) continue;

      const header = `\n--- ${result.path} (relevance: ${result.score}) ---\n`;
      const content = file.content.slice(0, Math.min(file.content.length, charBudget - header.length));

      if (charBudget <= 0) break;
      lines.push(header + content);
      charBudget -= header.length + content.length;
    }

    lines.push("\n=== END RELEVANT FILES ===\n");
    return lines.join("\n");
  },
});
