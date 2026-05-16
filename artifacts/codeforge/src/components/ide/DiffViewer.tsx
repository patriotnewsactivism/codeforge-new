/**
 * DIFF VIEWER — Side-by-side diff panel (inline in IDE tab)
 * Shows diffs from agent runs. User can browse changed files and accept/reject.
 */
import { useState, useMemo } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { GitCompareArrows, ArrowLeftRight, AlignJustify, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DiffLine {
  type: "add" | "remove" | "unchanged";
  content: string;
  lineNum: number;
}

function computeDiff(original: string, modified: string): DiffLine[] {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");
  const lines: DiffLine[] = [];
  const maxLen = Math.max(origLines.length, modLines.length);
  let lineNum = 1;
  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i];
    const m = modLines[i];
    if (o === undefined) {
      lines.push({ type: "add", content: m, lineNum: lineNum++ });
    } else if (m === undefined) {
      lines.push({ type: "remove", content: o, lineNum: lineNum++ });
    } else if (o !== m) {
      lines.push({ type: "remove", content: o, lineNum: lineNum });
      lines.push({ type: "add", content: m, lineNum: lineNum++ });
    } else {
      lines.push({ type: "unchanged", content: o, lineNum: lineNum++ });
    }
  }
  return lines;
}

interface DiffViewerProps {
  projectId: Id<"projects"> | null;
}

export function DiffViewer({ projectId }: DiffViewerProps) {
  const files = useQuery(api.files.listByProject, projectId ? { projectId } : "skip");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [mode, setMode] = useState<"unified" | "split">("unified");

  // For demo / real use: agent changes would be stored and fetched.
  // For now, show the current file content vs a placeholder "original".
  const currentFile = files?.find((f: NonNullable<typeof files>[number]) => f.path === selectedFile);
  const content = currentFile?.content ?? "";

  const diffLines = useMemo(() => {
    if (!content) return [];
    // Simulate "original" by showing current content as both sides (no real diff yet)
    // Real usage: fetch previous snapshot from Convex
    return computeDiff("", content);
  }, [content]);

  const addedCount = diffLines.filter((l) => l.type === "add").length;
  const removedCount = diffLines.filter((l) => l.type === "remove").length;

  const codeFiles = files?.filter((f: NonNullable<typeof files>[number]) => !f.isDirectory) ?? [];

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">Select a project to view diffs</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2 bg-white/[0.02] shrink-0">
        <GitCompareArrows className="h-4 w-4 text-rose-400/60" />
        <span className="text-xs font-semibold text-white/70 flex-1">Diff Viewer</span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={mode === "unified" ? "secondary" : "ghost"}
            className="h-6 px-2 text-[10px]"
            onClick={() => setMode("unified")}
          >
            <AlignJustify className="h-3 w-3 mr-1" />Unified
          </Button>
          <Button
            size="sm"
            variant={mode === "split" ? "secondary" : "ghost"}
            className="h-6 px-2 text-[10px]"
            onClick={() => setMode("split")}
          >
            <ArrowLeftRight className="h-3 w-3 mr-1" />Split
          </Button>
        </div>
      </div>

      {/* File selector */}
      <div className="border-b border-white/5 px-3 py-2 shrink-0">
        <div className="flex gap-1 flex-wrap">
          {codeFiles.slice(0, 12).map((f: NonNullable<typeof files>[number]) => (
            <button
              key={f.path}
              type="button"
              onClick={() => setSelectedFile(f.path)}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors",
                selectedFile === f.path
                  ? "bg-rose-500/20 text-rose-300"
                  : "bg-white/5 text-white/30 hover:text-white/60"
              )}
            >
              <File className="h-2.5 w-2.5" />
              {f.name}
            </button>
          ))}
          {codeFiles.length === 0 && (
            <span className="text-[10px] text-white/20">No files in project</span>
          )}
        </div>
      </div>

      {/* Stats */}
      {selectedFile && (
        <div className="flex gap-3 px-3 py-1.5 border-b border-white/5 text-[10px] shrink-0">
          <span className="text-green-400">+{addedCount} added</span>
          <span className="text-red-400">-{removedCount} removed</span>
          <span className="text-white/20">{selectedFile}</span>
        </div>
      )}

      {/* Diff content */}
      <ScrollArea className="flex-1">
        {!selectedFile ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-[11px] text-white/20">Select a file to view diff</p>
          </div>
        ) : (
          <div className="font-mono text-[11px]">
            {diffLines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "flex px-3 py-0 leading-5 min-h-[20px]",
                  line.type === "add" && "bg-green-500/10 text-green-300",
                  line.type === "remove" && "bg-red-500/10 text-red-300",
                  line.type === "unchanged" && "text-white/30"
                )}
              >
                <span className="w-6 shrink-0 text-white/20 select-none">{line.lineNum}</span>
                <span className="w-4 shrink-0 select-none">
                  {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                </span>
                <span className="flex-1 whitespace-pre-wrap break-all">{line.content}</span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
