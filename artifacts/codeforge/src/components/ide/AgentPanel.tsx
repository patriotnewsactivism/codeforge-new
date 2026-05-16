import { useState, useRef, useEffect } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Loader2, Check, AlertCircle, Zap, ToggleLeft, ToggleRight,
  Flame, ChevronRight, Brain} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AgentPanelProps {
  projectId: Id<"projects">;
}

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

const STATUS_ICON: Record<string, React.ReactNode> = {
  queued:  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse" />,
  running: <Loader2 className="h-3 w-3 text-primary animate-spin" />,
  done:    <Check className="h-3 w-3 text-green-400" />,
  error:   <AlertCircle className="h-3 w-3 text-red-400" />};

export function AgentPanel({ projectId }: AgentPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [tab, setTab] = useState<"run" | "history">("run");
  const thoughtsEndRef = useRef<HTMLDivElement>(null);

  const tasks = useQuery(api.agents.listTasks, { projectId });
  const thoughts = useQuery(api.agentThoughts.listRecent, { projectId, limit: 100 });
  const autonomousSettings = useQuery(api.suggestions.getAutonomousMode, { projectId });
  const runMission = useAction(api.engine.runMission);
  const runAutonomousCycle = useAction(api.suggestions.runAutonomousCycle);
  const setAutonomousMode = useMutation(api.suggestions.setAutonomousMode);

  const activeTasks = tasks?.filter((t: NonNullable<typeof tasks>[number]) => t.status === "running" || t.status === "queued") ?? [];
  const recentTasks = tasks?.filter((t: NonNullable<typeof tasks>[number]) => t.status === "done" || t.status === "error").slice(-20).reverse() ?? [];
  const autonomousOn = autonomousSettings?.autonomousMode ?? false;
  const isAgentRunning = isRunning || activeTasks.length > 0;

  // Auto-scroll thoughts
  useEffect(() => {
    thoughtsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thoughts?.length]);

  // Auto-switch to run tab when agents start
  useEffect(() => {
    if (activeTasks.length > 0) setTab("run");
  }, [activeTasks.length]);

  const handleRun = async () => {
    if (!prompt.trim() || isRunning) return;
    setIsRunning(true);
    setLastResult(null);
    setTab("run");
    try {
      const result = await runMission({ projectId, prompt: prompt.trim() });
      setLastResult(result);
      setPrompt("");
    } catch (e) {
      setLastResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleToggleAutonomous = async () => {
    try {
      await setAutonomousMode({ projectId, autonomousMode: !autonomousOn });
      toast.success(autonomousOn ? "Autonomous mode paused" : "🔥 Autonomous mode ON");
    } catch { toast.error("Failed to toggle"); }
  };

  const handleRunNow = async () => {
    try {
      toast.info("Running autonomous cycle...", { duration: 2000 });
      const result = await runAutonomousCycle({ projectId });
      toast.success(result.slice(0, 80));
    } catch (e) { toast.error(`Failed: ${String(e)}`); }
  };

  return (
    <div className="h-full flex flex-col bg-[oklch(0.11_0.02_260)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <Zap className="h-4 w-4 text-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">
          Agents
        </span>
        {activeTasks.length > 0 && (
          <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold animate-pulse">
            {activeTasks.length} running
          </span>
        )}
        <button type="button" onClick={handleToggleAutonomous}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors",
            autonomousOn
              ? "bg-amber-400/20 text-amber-400 border-amber-400/30"
              : "bg-white/5 text-muted-foreground border-border hover:text-foreground"
          )}>
          {autonomousOn ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
          Auto
        </button>
      </div>

      {/* Autonomous banner */}
      {autonomousOn && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-400/10 border-b border-amber-400/20 shrink-0">
          <Flame className="h-3 w-3 text-amber-400 shrink-0" />
          <p className="text-[10px] text-amber-300 flex-1 leading-snug">Self-building mode ON</p>
          <button type="button" onClick={handleRunNow}
            className="text-[9px] font-bold uppercase text-amber-400 hover:text-amber-300 px-2 py-0.5 border border-amber-400/30 rounded">
            Run Now
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        {(["run", "history"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
              tab === t ? "text-amber-400 border-b-2 border-amber-400" : "text-muted-foreground hover:text-foreground"
            )}>
            {t === "run" ? "Run" : `History (${recentTasks.length})`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* ── RUN TAB ── */}
        {tab === "run" && (
          <div className="flex-1 overflow-hidden flex flex-col">

            {/* LIVE THOUGHT STREAM — shows when agents are running */}
            {(isAgentRunning || (thoughts && thoughts.length > 0)) && (
              <div className={cn(
                "border-b border-border flex flex-col transition-all",
                isAgentRunning ? "flex-1" : "h-40"
              )}>
                <div className="flex items-center gap-2 px-2 py-1 border-b border-border/50 shrink-0">
                  <Brain className="h-3 w-3 text-violet-400" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-violet-400">
                    {isAgentRunning ? "Live Agent Thoughts" : "Last Run"}
                  </span>
                  {isAgentRunning && (
                    <span className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground/60">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" /> Working...
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 font-mono text-[10px]">
                  {/* Active task indicators */}
                  {activeTasks.map((task: NonNullable<typeof tasks>[number]) => (
                    <div key={task._id} className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-primary/5 border border-primary/15 mb-1">
                      <Loader2 className="h-2.5 w-2.5 text-primary animate-spin shrink-0" />
                      <span className="text-base leading-none">{task.agentIcon}</span>
                      <span className="text-primary font-semibold text-[10px] truncate">{task.agentName}</span>
                      <span className="text-muted-foreground/60 truncate text-[9px]">— {task.task.slice(0, 50)}</span>
                    </div>
                  ))}
                  {/* Thought lines */}
                  {(thoughts ?? []).slice(-60).map((t: NonNullable<typeof thoughts>[number], i: number, arr: NonNullable<typeof thoughts>[number][]) => {
                    const color = THOUGHT_COLORS[t.type] ?? "text-foreground/70";
                    const isLast = i === arr.length - 1;
                    return (
                      <div key={t._id} className={cn(
                        "flex items-start gap-1.5 px-1 py-0.5 rounded",
                        isLast ? "bg-[oklch(0.17_0.02_260)]" : ""
                      )}>
                        <span className="shrink-0 text-muted-foreground/30 text-[9px] w-12 tabular-nums pt-0.5">
                          {new Date(t.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                        <span className={cn("shrink-0 font-bold w-12 text-[9px] pt-0.5", color)}>[{t.type}]</span>
                        <span className={cn("flex-1 leading-relaxed break-words", color)}>
                          {t.content}
                          {isLast && t.isStreaming && <span className="inline-block w-1 h-2.5 bg-current ml-0.5 animate-pulse" />}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={thoughtsEndRef} />
                </div>
              </div>
            )}

            {/* Input section — shrinks when thoughts are visible */}
            <div className={cn(
              "flex flex-col gap-2 p-3 shrink-0",
              isAgentRunning ? "border-t border-border" : ""
            )}>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleRun(); }}
                placeholder="Give the agent swarm a task... (Ctrl+Enter to run)"
                rows={isAgentRunning ? 2 : 3}
                disabled={isRunning}
                className="w-full bg-[oklch(0.14_0.02_260)] border border-border rounded px-2.5 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-amber-400/50 resize-none"
              />

              <button type="button" onClick={handleRun}
                disabled={!prompt.trim() || isRunning}
                className="flex items-center justify-center gap-2 w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 text-amber-400 rounded font-bold text-[11px] transition-colors">
                {isRunning
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Agents working...</>
                  : <><Zap className="h-3.5 w-3.5" /> Launch Agent Swarm</>}
              </button>

              {/* Last result */}
              {lastResult && !isRunning && (
                <div className={cn(
                  "rounded border p-2 text-[10px] leading-relaxed",
                  lastResult.startsWith("Error:")
                    ? "border-red-500/20 bg-red-500/5 text-red-300"
                    : "border-green-500/20 bg-green-500/5 text-green-300"
                )}>
                  {lastResult.startsWith("Error:") ? <AlertCircle className="h-3 w-3 inline mr-1" /> : <Check className="h-3 w-3 inline mr-1" />}
                  {lastResult}
                </div>
              )}

              {/* Quick prompts — only show when idle */}
              {!isAgentRunning && !lastResult && (
                <div className="space-y-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">Quick tasks</p>
                  {[
                    "Fix all mobile layout issues and ensure every touch target is at least 44px",
                    "Add loading states and error boundaries to every panel",
                    "Polish the UI — better spacing, hover states, micro-animations",
                    "Add keyboard shortcuts and improve accessibility",
                  ].map(q => (
                    <button key={q} type="button" onClick={() => setPrompt(q)}
                      className="flex items-center gap-1.5 w-full text-left p-1.5 rounded bg-white/3 hover:bg-white/6 border border-border/50 hover:border-border text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/30" />
                      <span className="truncate">{q}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {recentTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14">
                <Zap className="h-8 w-8 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">No tasks run yet</p>
              </div>
            )}
            {recentTasks.map((task: NonNullable<typeof tasks>[number]) => (
              <div key={task._id} className={cn(
                "rounded-md border p-2.5",
                task.status === "error" ? "border-red-500/20 bg-red-500/5" : "border-border bg-[oklch(0.13_0.02_260)]"
              )}>
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{task.agentIcon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold">{task.agentName}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{task.task}</p>
                  </div>
                  <div className="shrink-0">{STATUS_ICON[task.status]}</div>
                </div>
                {task.result && (
                  <p className="text-[9px] text-muted-foreground/70 mt-1.5 ml-7 leading-relaxed">
                    {task.result.slice(0, 120)}{task.result.length > 120 ? "…" : ""}
                  </p>
                )}
                {task.filesChanged && task.filesChanged.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 ml-7">
                    {task.filesChanged.slice(0, 5).map((f: string) => (
                      <span key={f} className="text-[8px] bg-white/5 border border-border/50 px-1.5 py-0.5 rounded font-mono text-muted-foreground/60">
                        {f.split("/").pop()}
                      </span>
                    ))}
                    {task.filesChanged.length > 5 && (
                      <span className="text-[8px] text-muted-foreground/40">+{task.filesChanged.length - 5}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
