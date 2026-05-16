import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Loader2,
  Check,
  AlertCircle,
  Hammer,
  FileCode,
  FilePlus,
  Bug,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_ICONS: Record<string, React.ElementType> = {
  plan: Sparkles,
  create_file: FilePlus,
  edit_file: FileCode,
  fix_error: Bug,
  add_feature: Sparkles,
};

interface BuildProgressProps {
  projectId: Id<"projects">;
}

export function BuildProgress({ projectId }: BuildProgressProps) {
  const activeSession = useQuery(api.buildLoop.getActiveSession, { projectId });

  if (!activeSession) return null;

  return (
    <BuildSessionView
      buildSessionId={activeSession._id}
      currentStep={activeSession.currentStep}
      status={activeSession.status}
    />
  );
}

function BuildSessionView({
  buildSessionId,
  currentStep,
  status,
}: {
  buildSessionId: Id<"buildSessions">;
  currentStep?: string;
  status: string;
}) {
  const steps = useQuery(api.buildLoop.listSteps, { buildSessionId });

  return (
    <div className="bg-[oklch(0.12_0.02_260)] border border-border rounded-lg mx-2 mb-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-[oklch(0.10_0.02_260)]">
        {status === "running" ? (
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
        ) : status === "completed" ? (
          <Check className="h-4 w-4 text-green-400" />
        ) : (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
        <span className="text-xs font-semibold">
          {status === "running"
            ? "Building..."
            : status === "completed"
              ? "Build Complete"
              : "Build Error"}
        </span>
        {currentStep && status === "running" && (
          <span className="text-[10px] text-muted-foreground ml-auto truncate max-w-[60%]">
            {currentStep}
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="max-h-[200px] overflow-y-auto px-2 py-1.5 space-y-1">
        {steps?.map((step: NonNullable<typeof steps>[number]) => {
          const StepIcon = ACTION_ICONS[step.action] ?? Hammer;
          return (
            <div
              key={step._id}
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded text-xs",
                step.status === "running" && "bg-primary/5"
              )}
            >
              {step.status === "running" ? (
                <Loader2 className="h-3 w-3 text-primary animate-spin shrink-0" />
              ) : step.status === "done" ? (
                <Check className="h-3 w-3 text-green-400 shrink-0" />
              ) : (
                <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
              )}
              <StepIcon className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate text-muted-foreground">
                {step.description}
              </span>
              {step.filesChanged.length > 0 && (
                <span className="text-[9px] text-primary/60 ml-auto shrink-0">
                  {step.filesChanged.join(", ")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
