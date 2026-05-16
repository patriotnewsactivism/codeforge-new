/**
 * COSTBAR — Live cost meter across all active agents.
 * Shows today's spend, token counts, and active agent count.
 */
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { DollarSign, Zap, Bot, TrendingUp } from "lucide-react";

export function CostBar({ projectId }: { projectId: Id<"projects"> | null }) {
  const limitsData = useQuery(api.limits.getMyLimits);
  const agentTasks = useQuery(
    api.intelligence.listAgentTasks,
    projectId ? { projectId } : "skip"
  );

  const activeAgents = agentTasks?.filter((t: NonNullable<typeof agentTasks>[number]) => t.status === "running").length ?? 0;
  const todayCost = limitsData?.usage?.computeCostUsd ?? 0;
  const aiRequests = limitsData?.usage?.aiRequests ?? 0;
  const missions = limitsData?.usage?.missions ?? 0;

  return (
    <div className="flex items-center gap-4 border-b border-border bg-[oklch(0.09_0.015_260)] px-3 py-1 text-[10px] text-muted-foreground shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-1.5">
        <Zap className="h-3 w-3 text-amber-400" />
        <span className="font-bold text-foreground tracking-tight">CodeForge</span>
      </div>

      <div className="h-3 w-px bg-border" />

      {/* Active agents */}
      <div className="flex items-center gap-1">
        <Bot className={`h-2.5 w-2.5 ${activeAgents > 0 ? "text-green-400 animate-pulse" : "text-muted-foreground"}`} />
        <span className={activeAgents > 0 ? "text-green-400 font-semibold" : ""}>
          {activeAgents > 0 ? `${activeAgents} agent${activeAgents > 1 ? "s" : ""} running` : "No active agents"}
        </span>
      </div>

      <div className="h-3 w-px bg-border" />

      {/* Today's usage */}
      <div className="flex items-center gap-1">
        <TrendingUp className="h-2.5 w-2.5" />
        <span>{aiRequests} AI calls · {missions} missions today</span>
      </div>

      {/* Cost */}
      <div className="flex items-center gap-1">
        <DollarSign className="h-2.5 w-2.5 text-emerald-400" />
        <span className={todayCost > 0 ? "text-emerald-400 font-semibold" : ""}>
          ${todayCost.toFixed(4)} today
        </span>
      </div>

      <div className="flex-1" />

      {/* Live indicator */}
      {activeAgents > 0 && (
        <div className="flex items-center gap-1 text-green-400">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="font-semibold">LIVE</span>
        </div>
      )}
    </div>
  );
}
