import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Lightbulb,
  Zap,
  Check,
  X,
  Loader2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Flame,
  Star,
  Shield,
  Cpu,
  Smartphone,
  BarChart2,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SuggestionsPanelProps {
  projectId: Id<"projects">;
  onImplement?: (suggestion: { targetFile: string; content: string }) => void;
}

const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string }> = {
  ui: { icon: <Lightbulb className="h-3 w-3" />, color: "text-yellow-400" },
  functionality: { icon: <Zap className="h-3 w-3" />, color: "text-blue-400" },
  performance: { icon: <BarChart2 className="h-3 w-3" />, color: "text-green-400" },
  ux: { icon: <Star className="h-3 w-3" />, color: "text-pink-400" },
  security: { icon: <Lock className="h-3 w-3" />, color: "text-red-400" },
  mobile: { icon: <Smartphone className="h-3 w-3" />, color: "text-cyan-400" },
};

const PRIORITY_COLOR = {
  high: "text-red-400 bg-red-400/10 border-red-400/20",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  low: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

export function SuggestionsPanel({ projectId }: SuggestionsPanelProps) {
  const suggestions = useQuery(api.suggestions.listByProject, { projectId });
  const autonomousSettings = useQuery(api.suggestions.getAutonomousMode, { projectId });

  const generateSuggestions = useAction(api.suggestions.generateSuggestions);
  const implementSuggestion = useAction(api.suggestions.implementSuggestion);
  const setAutonomousMode = useMutation(api.suggestions.setAutonomousMode);
  const updateStatus = useMutation(api.suggestions.updateStatus);

  const [generating, setGenerating] = useState(false);
  const [implementing, setImplementing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "done" | "settings">("pending");
  const [soulText, setSoulText] = useState(autonomousSettings?.projectSoul ?? "");
  const [savingSoul, setSavingSoul] = useState(false);

  const pending = (suggestions ?? [])
    .filter((s: NonNullable<typeof suggestions>[number]) => s.status === "pending" || s.status === "implementing")
    .sort((a: NonNullable<typeof suggestions>[number], b: NonNullable<typeof suggestions>[number]) => ((b.impactScore ?? 5) - (a.impactScore ?? 5)));

  const done = (suggestions ?? []).filter((s: NonNullable<typeof suggestions>[number]) => s.status === "done");
  const dismissed = (suggestions ?? []).filter((s: NonNullable<typeof suggestions>[number]) => s.status === "dismissed");

  const autonomousOn = autonomousSettings?.autonomousMode ?? false;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const count = await generateSuggestions({ projectId });
      toast.success(count > 0 ? `${count} new suggestions added` : "Nothing new to suggest right now");
    } catch {
      toast.error("Failed to generate suggestions");
    } finally {
      setGenerating(false);
    }
  };

  const handleImplement = async (suggestionId: Id<"suggestions">, title: string) => {
    setImplementing(suggestionId);
    try {
      toast.info(`Building: ${title}...`, { duration: 3000 });
      await implementSuggestion({ projectId, suggestionId });
      toast.success(`"${title}" implemented!`);
    } catch (e) {
      toast.error(`Failed: ${String(e)}`);
    } finally {
      setImplementing(null);
    }
  };

  const handleDismiss = async (suggestionId: Id<"suggestions">) => {
    await updateStatus({ suggestionId, status: "dismissed" });
  };

  const handleToggleAutonomous = async () => {
    try {
      await setAutonomousMode({ projectId, autonomousMode: !autonomousOn });
      toast.success(autonomousOn ? "Autonomous mode off" : "Autonomous mode ON — system will self-build");
    } catch {
      toast.error("Failed to toggle autonomous mode");
    }
  };

  const handleSaveSoul = async () => {
    setSavingSoul(true);
    try {
      await setAutonomousMode({ projectId, autonomousMode: autonomousOn, projectSoul: soulText });
      toast.success("Project soul saved — agents will honor it");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSavingSoul(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[oklch(0.11_0.02_260)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <Lightbulb className="h-4 w-4 text-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">
          Suggestions
        </span>

        {/* Autonomous mode toggle */}
        <button
          type="button"
          onClick={handleToggleAutonomous}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors",
            autonomousOn
              ? "bg-amber-400/20 text-amber-400 border border-amber-400/30"
              : "bg-white/5 text-muted-foreground border border-border hover:text-foreground"
          )}
          title={autonomousOn ? "Autonomous mode ON — tap to pause" : "Enable autonomous mode"}
        >
          {autonomousOn ? (
            <><ToggleRight className="h-3 w-3" /> Auto</>
          ) : (
            <><ToggleLeft className="h-3 w-3" /> Auto</>
          )}
        </button>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="p-1.5 rounded text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-40"
          title="Generate suggestions"
        >
          {generating
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Autonomous mode banner */}
      {autonomousOn && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-400/10 border-b border-amber-400/20 shrink-0">
          <Flame className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <p className="text-[10px] text-amber-300 leading-snug">
            Autonomous mode is ON — the system will automatically build the top suggestion periodically.
            Ideas are always additive — nothing gets removed.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        {([
          ["pending", `Queue (${pending.length})`],
          ["done", `Done (${done.length})`],
          ["settings", "Soul"],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
              activeTab === tab
                ? "text-amber-400 border-b-2 border-amber-400"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── PENDING ── */}
        {activeTab === "pending" && (
          <div className="p-2 space-y-2">
            {pending.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 text-center px-4">
                <Lightbulb className="h-8 w-8 text-amber-400/20 mb-3" />
                <p className="text-sm text-muted-foreground">No suggestions yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
                  Hit the refresh button to analyze your project
                </p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/20 hover:bg-amber-400/30 text-amber-400 rounded text-xs font-semibold transition-colors"
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  Analyze Project
                </button>
              </div>
            )}

            {pending.map((s: NonNullable<typeof suggestions>[number]) => {
              const catMeta = CATEGORY_META[s.category] ?? CATEGORY_META.functionality!;
              const isBuilding = implementing === s._id || s.status === "implementing";

              return (
                <div
                  key={s._id}
                  className={cn(
                    "rounded-lg border p-3 transition-all",
                    isBuilding
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-[oklch(0.14_0.02_260)] hover:border-border/80"
                  )}
                >
                  {/* Top row */}
                  <div className="flex items-start gap-2 mb-2">
                    <div className={cn("mt-0.5 shrink-0", catMeta.color)}>
                      {catMeta.icon}
                    </div>
                    <p className="flex-1 text-[11px] font-semibold text-foreground leading-snug">
                      {s.title}
                    </p>
                    <span className={cn(
                      "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0",
                      PRIORITY_COLOR[s.priority as keyof typeof PRIORITY_COLOR]
                    )}>
                      {s.priority}
                    </span>
                  </div>

                  <p className="text-[10px] text-muted-foreground/80 mb-2 leading-relaxed pl-5">
                    {s.description}
                  </p>

                  {/* Impact score */}
                  {s.impactScore && (
                    <div className="flex items-center gap-1 pl-5 mb-2">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 10 }, (_, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-1.5 h-1.5 rounded-sm",
                              i < (s.impactScore ?? 0)
                                ? (s.impactScore ?? 0) >= 8
                                  ? "bg-red-400"
                                  : (s.impactScore ?? 0) >= 5
                                  ? "bg-amber-400"
                                  : "bg-blue-400"
                                : "bg-white/10"
                            )}
                          />
                        ))}
                      </div>
                      <span className="text-[9px] text-muted-foreground/50">
                        impact {s.impactScore}/10
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-1.5 pl-5">
                    <button
                      type="button"
                      onClick={() => handleImplement(s._id, s.title)}
                      disabled={isBuilding || !!implementing}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-primary/20 hover:bg-primary/30 disabled:opacity-40 text-primary rounded text-[10px] font-bold transition-colors"
                    >
                      {isBuilding ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Building...</>
                      ) : (
                        <><Zap className="h-3 w-3" /> Build This</>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismiss(s._id)}
                      disabled={isBuilding}
                      className="p-1.5 rounded bg-white/5 hover:bg-red-400/10 hover:text-red-400 text-muted-foreground disabled:opacity-40 transition-colors"
                      title="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {dismissed.length > 0 && (
              <p className="text-center text-[10px] text-muted-foreground/40 py-2">
                {dismissed.length} dismissed suggestion{dismissed.length > 1 ? "s" : ""} hidden
              </p>
            )}
          </div>
        )}

        {/* ── DONE ── */}
        {activeTab === "done" && (
          <div className="p-2 space-y-1.5">
            {done.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 text-center px-4">
                <Check className="h-8 w-8 text-green-400/20 mb-3" />
                <p className="text-sm text-muted-foreground">Nothing built yet</p>
              </div>
            )}
            {done.map((s: NonNullable<typeof suggestions>[number]) => (
              <div key={s._id} className="rounded-md border border-green-500/15 bg-green-500/5 p-2.5">
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-400 shrink-0" />
                  <p className="text-[11px] text-foreground flex-1">{s.title}</p>
                  {s.impactScore && (
                    <span className="text-[9px] text-green-400/60">{s.impactScore}/10</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground/60 ml-5 mt-0.5">{s.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── SOUL ── */}
        {activeTab === "settings" && (
          <div className="p-3 space-y-4">
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-[11px] font-semibold text-violet-300">Project Soul</span>
              </div>
              <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
                Describe the core identity, purpose, and non-negotiables of this project.
                Every agent will read this before making any change — and the QA agent will
                reject anything that contradicts it.
              </p>
            </div>

            <label className="block">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                What is this project? What must never change?
              </span>
              <textarea
                value={soulText || (autonomousSettings?.projectSoul ?? "")}
                onChange={e => setSoulText(e.target.value)}
                placeholder={`e.g. "This is a minimal, dark-themed code editor. The UI should always feel like a professional IDE — never toy-like. The core three-panel layout (file tree, editor, AI panel) is sacred and must never be removed or restructured."`}
                rows={8}
                className="mt-1.5 w-full bg-[oklch(0.14_0.02_260)] border border-border rounded px-2.5 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-violet-500 resize-none leading-relaxed"
              />
            </label>

            <button
              type="button"
              onClick={handleSaveSoul}
              disabled={savingSoul}
              className="w-full flex items-center justify-center gap-2 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded text-[11px] font-bold text-white transition-colors"
            >
              {savingSoul ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
              Save Project Soul
            </button>

            <div className="border-t border-border pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[11px] font-semibold text-muted-foreground">Autonomous Mode</span>
                <button
                  type="button"
                  onClick={handleToggleAutonomous}
                  className={cn(
                    "ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold transition-colors",
                    autonomousOn
                      ? "bg-amber-400/20 text-amber-400"
                      : "bg-white/5 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {autonomousOn ? "ON" : "OFF"}
                  {autonomousOn ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                When ON, the system automatically picks the highest-impact suggestion
                and builds it. It then generates new suggestions and continues the cycle —
                always adding, never replacing. The Project Soul is enforced on every run.
              </p>
              {autonomousSettings?.lastAutoRunAt && (
                <p className="text-[9px] text-muted-foreground/40 mt-2">
                  Last auto-run: {new Date(autonomousSettings.lastAutoRunAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
