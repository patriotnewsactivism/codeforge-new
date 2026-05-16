import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Brain } from "lucide-react";

interface ThoughtStreamProps {
  projectId: Id<"projects">;
}

const AGENT_ICONS: Record<string, string> = {
  "planner-agent": "🗺️",
  "ui-agent": "🎨",
  "logic-agent": "⚙️",
  "debug-agent": "🔍",
  "feature-agent": "✨",
  "test-agent": "🧪",
  "reviewer-agent": "🔎",
  "retrospective-agent": "🔄"};

const THOUGHT_COLORS: Record<string, string> = {
  plan:      "text-violet-400",
  analyze:   "text-blue-400",
  code:      "text-green-400",
  debug:     "text-red-400",
  review:    "text-orange-400",
  memory:    "text-purple-400",
  search:    "text-cyan-400",
  commit:    "text-yellow-400",
  broadcast: "text-pink-400",
  done:      "text-emerald-400"};

export function AgentThoughtStream({ projectId }: ThoughtStreamProps) {
  const thoughts = useQuery(api.agentThoughts.listRecent, { projectId, limit: 80 });
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new thoughts arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [thoughts, autoScroll]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  if (!thoughts || thoughts.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-4">
        <Brain className="h-8 w-8 text-violet-400/30 mb-3" />
        <p className="text-sm text-muted-foreground">Agent thoughts appear here</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Watch agents think in real-time as they plan, code, and review
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex-1 overflow-y-auto p-2 space-y-0.5 font-mono text-[11px]"
        onScroll={handleScroll}
      >
        {thoughts.map((thought: NonNullable<typeof thoughts>[number], i: number) => {
          const icon = AGENT_ICONS[thought.agentId] ?? "🤖";
          const color = THOUGHT_COLORS[thought.type] ?? "text-foreground";
          const isLast = i === thoughts.length - 1;

          return (
            <div
              key={thought._id}
              className={cn(
                "flex items-start gap-2 px-2 py-0.5 rounded transition-all",
                isLast ? "bg-[oklch(0.17_0.02_260)]" : "hover:bg-[oklch(0.14_0.02_260)]"
              )}
            >
              <span className="shrink-0 text-[10px] text-muted-foreground/40 w-14 pt-0.5 tabular-nums">
                {new Date(thought.timestamp).toLocaleTimeString([], {
                  hour: "2-digit", minute: "2-digit", second: "2-digit"
                })}
              </span>
              <span className="shrink-0">{icon}</span>
              <span className={cn("shrink-0 font-semibold w-14 truncate pt-0.5", color)}>
                [{thought.type}]
              </span>
              <span className={cn("flex-1 leading-relaxed pt-0.5 break-words", color)}>
                {thought.content}
                {isLast && thought.isStreaming && (
                  <span className="inline-block w-1.5 h-3 bg-current ml-0.5 animate-pulse" />
                )}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {!autoScroll && (
        <button
          type="button"
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
          className="mx-2 mb-2 py-1 text-[10px] text-muted-foreground hover:text-foreground bg-[oklch(0.17_0.02_260)] rounded text-center"
        >
          ↓ Jump to latest
        </button>
      )}
    </div>
  );
}
