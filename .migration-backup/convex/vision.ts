/**
 * CODEFORGE v2 — VISION API (UPGRADE #2)
 * GPT-4o Vision for screenshot-to-code analysis
 */
import { v } from "convex/values";
import { action } from "./_generated/server";

declare const process: { env: Record<string, string | undefined> };

export const analyzeScreenshot = action({
  args: {
    imageBase64: v.string(),
    mode: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, { imageBase64, mode, projectId }) => {
    void ctx; void projectId;
    const apiKey = process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_KEY;
    if (!apiKey) throw new Error("No vision API key configured");

    const modePrompts: Record<string, string> = {
      build: "Describe this UI in detail: layout, components, colors, spacing, interactions. Be specific enough that a developer could recreate it.",
      fix: "This is a screenshot of a bug or error. Describe: what the error is, what caused it, and what code changes would fix it.",
      copy: "Analyze this design. Describe: color palette (exact hex values), typography, layout grid, component structure, spacing, and any animations.",
      analyze: "Analyze this screenshot and suggest 3-5 specific improvements for: UX, performance, accessibility, and visual design.",
    };

    const prompt = modePrompts[mode] || modePrompts.build;

    // Extract base64 data (remove data URL prefix if present)
    const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const mimeType = imageBase64.includes("data:") 
      ? imageBase64.split(";")[0].split(":")[1]
      : "image/png";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: "data:" + mimeType + ";base64," + base64Data,
                detail: "high",
              }
            }
          ]
        }]
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error("Vision API error: " + err);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "Could not analyze image.";
    return { analysis, mode };
  },
});
