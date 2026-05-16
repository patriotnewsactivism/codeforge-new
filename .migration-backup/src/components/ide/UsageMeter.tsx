/**
 * UsageMeter.tsx
 * Compact usage + compute spend widget for the IDE chat panel.
 * Shows daily AI requests remaining, missions remaining, and monthly compute spend.
 * Near-limit states pulse orange. At-limit shows upgrade CTA.
 */
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { Zap, Bot, TrendingUp, ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const PLAN_COLORS: Record<string, string> = {
  free: "text-muted-foreground",
  weekly: "text-blue-400",
  monthly: "text-violet-400",
  lifetime: "text-amber-400",
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  weekly: "Weekly",
  monthly: "Pro",
  lifetime: "Founder",
};

function Bar({ used, total, color }: { used: number; total: number; color: string }) {
  const pct = Math.min((used / total) * 100, 100);
  const isNearLimit = pct >= 75;
  const isAtLimit = pct >= 100;
  return (
    <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          isAtLimit ? "bg-red-500" : isNearLimit ? "bg-amber-400 animate-pulse" : color
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function UsageMeter() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const limits = useQuery(api.limits.getMyLimits);

  if (!limits) return null;

  const { plan, limits: l, usage, spend } = limits;
  const planLabel = PLAN_LABELS[plan] ?? plan;
  const planColor = PLAN_COLORS[plan] ?? "text-muted-foreground";

  const aiUsed = usage?.aiRequests ?? 0;
  const missionsUsed = usage?.missions ?? 0;
  const computeUsed = spend?.totalCostUsd ?? 0;
  const computeCap = spend?.capUsd ?? l.hardCapUsdMonthly;

  const aiPct = (aiUsed / l.aiRequestsPerDay) * 100;
  const missionPct = (missionsUsed / l.missionsPerDay) * 100;
  const computePct = (computeUsed / computeCap) * 100;

  const atAiLimit = aiPct >= 100;
  const atMissionLimit = missionPct >= 100;
  const nearAny = aiPct >= 75 || missionPct >= 75 || computePct >= 85;
  const cappedOut = spend?.cappedAt != null || computePct >= 100;

  const aiLeft = Math.max(0, l.aiRequestsPerDay - aiUsed);

  return (
    <div className="shrink-0">
      {/* Collapsed pill */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-colors",
          cappedOut
            ? "bg-red-500/15 text-red-400 border border-red-500/25"
            : nearAny
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              : "bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10",
        )}
      >
        <Zap className={cn("h-3 w-3", cappedOut ? "text-red-400" : nearAny ? "text-amber-400 animate-pulse" : planColor)} />
        <span className={planColor}>{planLabel}</span>
        <span className="opacity-60">·</span>
        <span className={atAiLimit ? "text-red-400" : ""}>{aiLeft} req</span>
        {expanded ? <ChevronUp className="h-3 w-3 opacity-50" /> : <ChevronDown className="h-3 w-3 opacity-50" />}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="absolute z-50 right-0 top-full mt-1 w-56 rounded-xl border border-border bg-[oklch(0.14_0.02_260)] shadow-xl p-3 space-y-3">
          {/* AI requests */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Zap className="h-3 w-3" /> AI Requests
              </span>
              <span className={cn("font-medium", atAiLimit ? "text-red-400" : "")}>
                {aiUsed} / {l.aiRequestsPerDay}
              </span>
            </div>
            <Bar used={aiUsed} total={l.aiRequestsPerDay} color="bg-violet-500" />
            <p className="text-[9px] text-muted-foreground">Resets midnight UTC</p>
          </div>

          {/* Missions */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Bot className="h-3 w-3" /> Missions
              </span>
              <span className={cn("font-medium", atMissionLimit ? "text-red-400" : "")}>
                {missionsUsed} / {l.missionsPerDay}
              </span>
            </div>
            <Bar used={missionsUsed} total={l.missionsPerDay} color="bg-blue-500" />
          </div>

          {/* Compute spend */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1 text-muted-foreground">
                <TrendingUp className="h-3 w-3" /> Compute
              </span>
              <span className={cn("font-medium tabular-nums", cappedOut ? "text-red-400" : "")}>
                ${computeUsed.toFixed(3)} / ${computeCap.toFixed(2)}
              </span>
            </div>
            <Bar used={computeUsed} total={computeCap} color="bg-green-500" />
            <p className="text-[9px] text-muted-foreground">Monthly hard cap — you're always protected</p>
          </div>

          {/* Upgrade CTA */}
          {plan !== "lifetime" && (
            <button
              type="button"
              onClick={() => { navigate("/pricing"); setExpanded(false); }}
              className={cn(
                "w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors",
                cappedOut || atAiLimit || atMissionLimit
                  ? "bg-violet-600 text-white hover:bg-violet-500 animate-pulse"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground",
              )}
            >
              {cappedOut || atAiLimit || atMissionLimit
                ? "⚡ Upgrade to keep building"
                : "View plans"}
              <ArrowUpRight className="h-3 w-3" />
            </button>
          )}

          {plan === "lifetime" && (
            <div className="text-center text-[9px] text-amber-400/70">
              👑 Founder — you're maxed out. Nice.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
