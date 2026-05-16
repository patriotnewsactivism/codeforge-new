/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — COST DASHBOARD
 * ═══════════════════════════════════════════════════════════════════
 *
 * Track AI spending per model, per mission, and over time.
 * Visual breakdown with bar charts.
 */
import type { Id } from "../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  Cpu,
  Activity,
  BarChart3,
} from "lucide-react";

interface CostDashboardProps {
  projectId: Id<"projects"> | null;
  sessionId?: Id<"sessions"> | null;
}

export function CostDashboard({ projectId, sessionId: _sessionId }: CostDashboardProps) {
  const costEntries = useQuery(
    api.costEntries.listByProject,
    projectId ? { projectId } : "skip"
  );

  const entries = costEntries || [];

  // Aggregate by model
  const byModel = new Map<string, { cost: number; tokens: number; calls: number }>();
  let totalCost = 0;
  let totalTokens = 0;

  for (const entry of entries) {
    totalCost += entry.cost || 0;
    totalTokens += (entry.inputTokens || 0) + (entry.outputTokens || 0);

    const key = entry.model || "unknown";
    const prev = byModel.get(key) || { cost: 0, tokens: 0, calls: 0 };
    byModel.set(key, {
      cost: prev.cost + (entry.cost || 0),
      tokens: prev.tokens + (entry.inputTokens || 0) + (entry.outputTokens || 0),
      calls: prev.calls + 1,
    });
  }

  const modelEntries = [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const maxCost = Math.max(...modelEntries.map(([, v]) => v.cost), 0.001);

  // Model display names + colors
  const MODEL_COLORS: Record<string, string> = {
    "deepseek": "bg-blue-500",
    "grok": "bg-orange-500",
    "kimi": "bg-purple-500",
  };

  function getModelColor(model: string) {
    for (const [key, color] of Object.entries(MODEL_COLORS)) {
      if (model.toLowerCase().includes(key)) return color;
    }
    return "bg-emerald-500";
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0d0d14]">
        <DollarSign className="h-4 w-4 text-emerald-400" />
        <span className="text-xs font-semibold text-white/80">Cost Dashboard</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 p-3">
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
          <div className="flex items-center gap-1 mb-1">
            <DollarSign className="h-3 w-3 text-emerald-400" />
            <span className="text-[9px] text-white/30 uppercase tracking-wider">Total Cost</span>
          </div>
          <p className="text-lg font-bold text-emerald-400">${totalCost.toFixed(4)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
          <div className="flex items-center gap-1 mb-1">
            <Activity className="h-3 w-3 text-blue-400" />
            <span className="text-[9px] text-white/30 uppercase tracking-wider">API Calls</span>
          </div>
          <p className="text-lg font-bold text-blue-400">{entries.length}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
          <div className="flex items-center gap-1 mb-1">
            <Cpu className="h-3 w-3 text-purple-400" />
            <span className="text-[9px] text-white/30 uppercase tracking-wider">Tokens</span>
          </div>
          <p className="text-lg font-bold text-purple-400">
            {totalTokens > 1000000
              ? `${(totalTokens / 1000000).toFixed(1)}M`
              : totalTokens > 1000
              ? `${(totalTokens / 1000).toFixed(1)}K`
              : totalTokens}
          </p>
        </div>
      </div>

      {/* By model */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-1 mb-2">
          <BarChart3 className="h-3.5 w-3.5 text-white/30" />
          <span className="text-[10px] font-semibold text-white/50">Cost by Model</span>
        </div>
        <div className="space-y-2">
          {modelEntries.map(([model, data]) => (
            <div key={model}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn("w-2 h-2 rounded-full", getModelColor(model))} />
                  <span className="text-[11px] text-white/60">{model}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/30">{data.calls} calls</span>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    ${data.cost.toFixed(4)}
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", getModelColor(model))}
                  style={{ width: `${(data.cost / maxCost) * 100}%`, opacity: 0.6 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent entries */}
      <div className="px-3 pb-3 flex-1">
        <div className="flex items-center gap-1 mb-2">
          <TrendingUp className="h-3.5 w-3.5 text-white/30" />
          <span className="text-[10px] font-semibold text-white/50">Recent Calls</span>
        </div>
        <div className="space-y-0.5">
          {entries.slice(-20).reverse().map((entry: NonNullable<typeof entries>[number]) => (
            <div
              key={entry._id}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.03] transition-colors"
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", getModelColor(entry.model || ""))} />
              <span className="text-[10px] text-white/40 truncate flex-1">
                {entry.model || "unknown"}
              </span>
              <span className="text-[9px] text-white/20">
                {(entry.inputTokens || 0) + (entry.outputTokens || 0)} tok
              </span>
              <span className="text-[10px] text-emerald-400/60 font-mono">
                ${(entry.cost || 0).toFixed(4)}
              </span>
            </div>
          ))}
          {entries.length === 0 && (
            <div className="text-center py-6 text-white/20 text-xs">
              No cost data yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
