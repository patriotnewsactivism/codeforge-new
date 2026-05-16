/**
 * DEPLOY PANEL — Inline IDE tab for deployment options
 * Instant preview, share link, ZIP export, GitHub Pages, Vercel/Netlify.
 */
import type { Id } from "../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Rocket,
  Eye,
  Link2,
  Download,
  Github,
  ExternalLink,
  Loader2,
  Check,
  Globe,
} from "lucide-react";

interface DeployPanelProps {
  projectId: Id<"projects"> | null;
}

export function DeployPanel({ projectId }: DeployPanelProps) {
  const files = useQuery(api.files.listByProject, projectId ? { projectId } : "skip");
  const project = useQuery(api.projects.get, projectId ? { projectId } : "skip");
  const githubSettings = useQuery(api.github.getSettings);

  const [deployingTo, setDeployingTo] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleInstantPreview = useCallback(() => {
    if (!files) return;
    setDeployingTo("preview");
    try {
      const htmlFile = files.find((f: NonNullable<typeof files>[number]) => f.path === "index.html");
      if (!htmlFile?.content) {
        toast.error("No index.html found");
        setDeployingTo(null);
        return;
      }
      const blob = new Blob([htmlFile.content], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      window.open(url, "_blank");
      toast.success("Preview opened in new tab");
    } catch {
      toast.error("Failed to create preview");
    } finally {
      setDeployingTo(null);
    }
  }, [files]);

  const handleShareLink = useCallback(() => {
    if (!files) return;
    setDeployingTo("share");
    try {
      const htmlFile = files.find((f: NonNullable<typeof files>[number]) => f.path === "index.html");
      if (!htmlFile?.content) {
        toast.error("No index.html found");
        setDeployingTo(null);
        return;
      }
      const encoded = encodeURIComponent(htmlFile.content);
      const dataUrl = `data:text/html;charset=utf-8,${encoded}`;
      // (shareUrl removed)
      navigator.clipboard.writeText(dataUrl).then(() => {
        toast.success("Share URL copied to clipboard");
      });
    } catch {
      toast.error("Failed to create share link");
    } finally {
      setDeployingTo(null);
    }
  }, [files]);

  const handleExportZip = useCallback(async () => {
    if (!files) return;
    setDeployingTo("zip");
    try {
      // Build a simple downloadable HTML string with all files inlined
      const htmlFile = files.find((f: NonNullable<typeof files>[number]) => f.path === "index.html");
      const content = htmlFile?.content || "<!-- No index.html found -->";
      const blob = new Blob([content], { type: "text/html" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${project?.name ?? "codeforge-project"}.html`;
      a.click();
      toast.success("Project downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setDeployingTo(null);
    }
  }, [files, project]);

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">Select a project to deploy</p>
      </div>
    );
  }

  const deployOptions = [
    {
      id: "preview",
      label: "Instant Preview",
      desc: "Open in a new browser tab — no server needed",
      icon: <Eye className="h-4 w-4 text-blue-400" />,
      action: handleInstantPreview,
      badge: "Instant",
      badgeColor: "bg-blue-500/10 text-blue-400",
    },
    {
      id: "share",
      label: "Share Link",
      desc: "Copy a data URL to share directly",
      icon: <Link2 className="h-4 w-4 text-purple-400" />,
      action: handleShareLink,
      badge: "Free",
      badgeColor: "bg-purple-500/10 text-purple-400",
    },
    {
      id: "zip",
      label: "Download HTML",
      desc: "Download index.html to deploy anywhere",
      icon: <Download className="h-4 w-4 text-amber-400" />,
      action: handleExportZip,
      badge: "Offline",
      badgeColor: "bg-amber-500/10 text-amber-400",
    },
    {
      id: "github-pages",
      label: "GitHub Pages",
      desc: githubSettings?.connected ? "Push to gh-pages branch" : "Connect GitHub first",
      icon: <Github className="h-4 w-4 text-white/50" />,
      action: () => toast.info("Push to GitHub first, then enable Pages in repo Settings"),
      badge: githubSettings?.connected ? "Available" : "Needs Auth",
      badgeColor: githubSettings?.connected ? "bg-green-500/10 text-green-400" : "bg-white/5 text-white/30",
      disabled: !githubSettings?.connected,
    },
    {
      id: "vercel",
      label: "Vercel",
      desc: "Deploy via Vercel CLI (coming soon)",
      icon: <Globe className="h-4 w-4 text-white/30" />,
      action: () => toast.info("Vercel integration coming soon"),
      badge: "Soon",
      badgeColor: "bg-white/5 text-white/20",
      disabled: true,
    },
  ];

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2 bg-white/[0.02] shrink-0">
        <Rocket className="h-4 w-4 text-green-400/60" />
        <span className="text-xs font-semibold text-white/70 flex-1">Deploy</span>
        <Badge className="text-[9px] h-4 px-1.5 bg-white/5 text-white/30 border-0">
          {files?.filter((f: NonNullable<typeof files>[number]) => !f.isDirectory).length ?? 0} files
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {/* Active preview URL */}
          {previewUrl && (
            <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2">
              <Check className="h-3.5 w-3.5 text-green-400 shrink-0" />
              <span className="text-[10px] text-green-300 flex-1 truncate">Preview ready</span>
              <button
                type="button"
                onClick={() => window.open(previewUrl, "_blank")}
                className="text-green-400 hover:text-green-300"
              >
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Deploy options */}
          {deployOptions.map((opt) => (
            <div
              key={opt.id}
              className={cn(
                "rounded-lg border border-white/5 p-3 bg-white/[0.02] flex items-center gap-3",
                opt.disabled ? "opacity-40" : "hover:border-white/10 transition-colors"
              )}
            >
              <div className="shrink-0">{opt.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white/70">{opt.label}</span>
                  <Badge className={`text-[8px] h-3.5 px-1 border-0 ${opt.badgeColor}`}>
                    {opt.badge}
                  </Badge>
                </div>
                <p className="text-[10px] text-white/30 truncate">{opt.desc}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs border-white/10 shrink-0"
                onClick={opt.action}
                disabled={!!opt.disabled || deployingTo === opt.id}
              >
                {deployingTo === opt.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Deploy"
                )}
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}
