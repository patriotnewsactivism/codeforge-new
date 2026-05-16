import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useConvexAuth } from "convex/react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap, Crown, Clock, Sparkles, Check, ArrowRight,
  Bot, GitBranch, Lock, Unlock, Infinity, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Spawn visualizer: animates agent tree expanding ──────────────────────────
function SpawnTree({ depth: _depth, maxDepth, animate }: { depth: number; maxDepth: number; animate: boolean }) {
  const nodes: { level: number; index: number }[] = [];
  let count = 1;
  for (let d = 0; d < maxDepth; d++) {
    for (let i = 0; i < count; i++) nodes.push({ level: d, index: i });
    count = Math.min(count * 2, 16); // cap display at 16 per row
  }
  const total = Math.pow(2, maxDepth) - 1;

  return (
    <div className="select-none">
      <div className="flex flex-col gap-1 items-center">
        {Array.from({ length: maxDepth }, (_, d) => {
          const rowCount = Math.min(Math.pow(2, d), 16);
          return (
            <div key={d} className="flex gap-1 justify-center">
              {Array.from({ length: rowCount }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-full transition-all duration-500",
                    d === 0 ? "w-4 h-4" : d === 1 ? "w-3 h-3" : "w-2 h-2",
                    animate ? "bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.8)]" : "bg-border",
                  )}
                  style={{ transitionDelay: animate ? `${(d * 100 + i * 20)}ms` : "0ms" }}
                />
              ))}
              {Math.pow(2, d) > 16 && (
                <span className="text-[9px] text-muted-foreground self-center ml-1">
                  +{Math.pow(2, d) - 16} more
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-center text-[10px] text-muted-foreground mt-2">
        {total >= 31 ? `Up to ${Math.pow(2, maxDepth) - 1}+ simultaneous agents` : `Up to ${total} simultaneous agents`}
      </p>
    </div>
  );
}

// ── Plan data ────────────────────────────────────────────────────────────────
const PLANS = [
  {
    key: "free" as const,
    name: "Free",
    price: "$0",
    period: "forever",
    icon: Sparkles,
    iconColor: "text-muted-foreground",
    cardClass: "border-border bg-card",
    headerClass: "bg-card",
    badge: null,
    spawnDepth: 1,
    spawnTotal: 3,
    agentLabel: "3 agents max",
    features: [
      { text: "15 AI requests / day", locked: false },
      { text: "2 missions / day", locked: false },
      { text: "1 agent at a time", locked: false },
      { text: "Spawn depth: 1 (3 agents)", locked: false },
      { text: "2 projects", locked: false },
      { text: "Community support", locked: false },
      { text: "Parallel agent swarms", locked: true },
      { text: "Deep recursive spawning", locked: true },
    ],
    cta: "Get Started Free",
    ctaClass: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    stripePlan: null,
  },
  {
    key: "weekly" as const,
    name: "Weekly Boost",
    price: "$9.99",
    period: "/ week",
    icon: Clock,
    iconColor: "text-blue-400",
    cardClass: "border-blue-500/40 bg-card",
    headerClass: "bg-blue-500/5",
    badge: null,
    spawnDepth: 3,
    spawnTotal: 30,
    agentLabel: "Up to 30 agents / mission",
    features: [
      { text: "250 AI requests / day", locked: false },
      { text: "20 missions / day", locked: false },
      { text: "5 concurrent agents", locked: false },
      { text: "Spawn depth: 3 (up to 30 agents)", locked: false },
      { text: "15 projects", locked: false },
      { text: "$5 compute / week included", locked: false },
      { text: "Priority support", locked: false },
      { text: "Deep recursive spawning", locked: true },
    ],
    cta: "Start Weekly",
    ctaClass: "bg-blue-600 text-white hover:bg-blue-500",
    stripePlan: "weekly" as const,
  },
  {
    key: "monthly" as const,
    name: "Monthly Pro",
    price: "$29.99",
    period: "/ month",
    icon: Zap,
    iconColor: "text-violet-400",
    cardClass: "border-violet-500 bg-card ring-1 ring-violet-500/30",
    headerClass: "bg-violet-500/10",
    badge: "Most Popular",
    spawnDepth: 4,
    spawnTotal: 80,
    agentLabel: "Up to 80 agents / mission",
    features: [
      { text: "600 AI requests / day", locked: false },
      { text: "60 missions / day", locked: false },
      { text: "12 concurrent agents", locked: false },
      { text: "Spawn depth: 4 (up to 80 agents!)", locked: false },
      { text: "30 projects", locked: false },
      { text: "$15 compute / month included", locked: false },
      { text: "Priority support", locked: false },
      { text: "Early feature access", locked: false },
    ],
    cta: "Go Pro",
    ctaClass: "bg-violet-600 text-white hover:bg-violet-500",
    stripePlan: "monthly" as const,
  },
  {
    key: "lifetime" as const,
    name: "Founder",
    price: "$420",
    period: "one-time",
    icon: Crown,
    iconColor: "text-amber-400",
    cardClass: "border-amber-500/60 bg-card ring-1 ring-amber-500/20",
    headerClass: "bg-amber-500/10",
    badge: "First 50 Only",
    spawnDepth: 5,
    spawnTotal: 250,
    agentLabel: "Up to 250 agents / mission",
    features: [
      { text: "1,500 AI requests / day", locked: false },
      { text: "150 missions / day", locked: false },
      { text: "32 concurrent agents", locked: false },
      { text: "Spawn depth: 5 (up to 250 agents!!!)", locked: false },
      { text: "200 projects", locked: false },
      { text: "$50 compute / month forever", locked: false },
      { text: "VIP Discord + direct support", locked: false },
      { text: "All future features, forever", locked: false },
      { text: "Founder badge on profile", locked: false },
    ],
    cta: "Become a Founder",
    ctaClass: "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400",
    stripePlan: "lifetime" as const,
  },
];

export function PricingPage() {
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const myLimits = useQuery(api.limits.getMyLimits);

  const handleCheckout = async (plan: "weekly" | "monthly" | "lifetime") => {
    if (!isAuthenticated) { navigate("/login?redirect=/pricing"); return; }
    setLoading(plan); setError(null);
    try {
      const { url } = await createCheckout({ plan });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
    } finally { setLoading(null); }
  };

  const currentPlan = myLimits?.plan ?? "free";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Hero ── */}
      <div className="max-w-6xl mx-auto px-4 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-300 font-medium mb-6">
          <Bot className="h-3.5 w-3.5" />
          Exponential AI Agents — One Task, Hundreds of Workers
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Upgrade your <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">agent army</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Free gets you a taste. Pro unleashes a recursive swarm of AI agents that
          spawn sub-agents, then sub-sub-agents — finishing in minutes what would
          take you hours.
        </p>

        {/* Live spawn visualizer */}
        <div className="mt-10 flex flex-wrap justify-center gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className="text-center cursor-pointer"
              onMouseEnter={() => setHoveredPlan(plan.key)}
              onMouseLeave={() => setHoveredPlan(null)}
            >
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">
                {plan.name}
              </p>
              <SpawnTree
                depth={plan.key === "free" ? 2 : plan.spawnDepth}
                maxDepth={plan.key === "free" ? 2 : plan.spawnDepth}
                animate={hoveredPlan === plan.key}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Hover a plan to see its agent swarm in action →
        </p>
      </div>

      {/* ── Cards ── */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlan === plan.key;
            const Icon = plan.icon;
            return (
              <div
                key={plan.key}
                className={cn(
                  "rounded-xl border flex flex-col overflow-hidden transition-all duration-200",
                  plan.cardClass,
                  hoveredPlan === plan.key && "scale-[1.02] shadow-lg shadow-violet-500/10",
                )}
                onMouseEnter={() => setHoveredPlan(plan.key)}
                onMouseLeave={() => setHoveredPlan(null)}
              >
                {/* Badge */}
                <div className="h-6 flex items-center justify-center">
                  {plan.badge && (
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-3 py-0.5 rounded-b-md",
                      plan.key === "lifetime" ? "bg-amber-500/20 text-amber-300" : "bg-violet-500/20 text-violet-300",
                    )}>
                      {plan.badge}
                    </span>
                  )}
                </div>

                {/* Header */}
                <div className={cn("px-5 pt-4 pb-5", plan.headerClass)}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={cn("h-5 w-5", plan.iconColor)} />
                    <span className="font-semibold text-sm">{plan.name}</span>
                    {isCurrentPlan && (
                      <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm pb-1">{plan.period}</span>
                  </div>

                  {/* Agent swarm badge */}
                  <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-black/20 px-2.5 py-1.5">
                    <GitBranch className={cn("h-3.5 w-3.5", plan.iconColor)} />
                    <span className="text-[11px] font-medium">{plan.agentLabel}</span>
                  </div>
                </div>

                {/* Features */}
                <div className="px-5 py-4 flex-1 space-y-2">
                  {plan.features.map((f, i) => (
                    <div key={i} className={cn("flex items-start gap-2", f.locked && "opacity-40")}>
                      {f.locked
                        ? <Lock className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        : <Check className="h-3.5 w-3.5 mt-0.5 text-green-400 shrink-0" />
                      }
                      <span className="text-xs leading-snug">{f.text}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="px-5 pb-5">
                  {plan.stripePlan ? (
                    <button
                      type="button"
                      onClick={() => handleCheckout(plan.stripePlan!)}
                      disabled={loading === plan.key || isCurrentPlan}
                      className={cn(
                        "w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2",
                        plan.ctaClass,
                        (loading === plan.key || isCurrentPlan) && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      {loading === plan.key ? (
                        <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                      ) : isCurrentPlan ? (
                        "Active Plan"
                      ) : (
                        <>{plan.cta} <ArrowRight className="h-4 w-4" /></>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => isAuthenticated ? navigate("/dashboard") : navigate("/signup")}
                      className={cn("w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2", plan.ctaClass)}
                    >
                      {plan.cta} <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 text-center text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 max-w-lg mx-auto">
            {error}
          </div>
        )}

        {/* ── FAQ / Trust ── */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="space-y-2">
            <TrendingUp className="h-6 w-6 text-violet-400 mx-auto" />
            <h3 className="font-semibold text-sm">Exponential Parallelism</h3>
            <p className="text-xs text-muted-foreground">
              Agents spawn sub-agents that spawn sub-agents. Monthly Pro can run 80 parallel
              workers on a single task — finishing in seconds what normally takes hours.
            </p>
          </div>
          <div className="space-y-2">
            <Infinity className="h-6 w-6 text-blue-400 mx-auto" />
            <h3 className="font-semibold text-sm">Cancel Anytime, Keep the Code</h3>
            <p className="text-xs text-muted-foreground">
              Your projects and files are always yours. Cancel anytime and your work stays.
              Lifetime Founder keeps paying as AI prices drop.
            </p>
          </div>
          <div className="space-y-2">
            <Unlock className="h-6 w-6 text-green-400 mx-auto" />
            <h3 className="font-semibold text-sm">Free to Start, Hard to Leave</h3>
            <p className="text-xs text-muted-foreground">
              Start free with 15 requests/day. The moment you see a 3-agent swarm build
              your feature in 90 seconds, you'll want to see what 80 agents can do.
            </p>
          </div>
        </div>

        {/* Lifetime pitch */}
        <div className="mt-12 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center max-w-2xl mx-auto">
          <Crown className="h-8 w-8 text-amber-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold mb-2">The Lifetime Case</h3>
          <p className="text-sm text-muted-foreground mb-4">
            $420 once vs $29.99/mo forever. Break-even is 14 months.
            AI compute prices have been dropping ~40% per year — your lifetime deal
            only gets more valuable over time. And if AI prices ever spike?
            The hard cap protects you. We absorb the risk.
          </p>
          <p className="text-xs text-amber-400/80 font-medium">
            🔥 First 50 founders only. {" "}
            <button
              type="button"
              onClick={() => handleCheckout("lifetime")}
              className="underline hover:text-amber-300"
            >
              Lock in your spot →
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
