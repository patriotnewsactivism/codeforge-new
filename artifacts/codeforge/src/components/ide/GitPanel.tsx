/**
 * CODEFORGE v2 — GIT PANEL
 * Push/Pull from GitHub. Import repos. Shows build session history.
 */
import type { Id } from "../../convex/_generated/dataModel";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  GitBranch,
  Github,
  Upload,
  Download,
  Loader2,
  RefreshCw,
  Check,
  AlertTriangle,
  FolderDown,
  KeyRound,
} from "lucide-react";
import { GitHubConnectDialog } from "./GitHubConnectDialog";
import { ImportRepoDialog } from "./ImportRepoDialog";

interface GitPanelProps {
  projectId: Id<"projects"> | null;
}

export function GitPanel({ projectId }: GitPanelProps) {
  const githubSettings = useQuery(api.github.getSettings);
  const buildSessions = useQuery(
    api.missions.listByProject,
    projectId ? { projectId } : "skip"
  );
  const activeProject = useQuery(
    api.projects.get,
    projectId ? { projectId } : "skip"
  );
  const allFiles = useQuery(
    api.files.listByProject,
    projectId ? { projectId } : "skip"
  );

  const commitFile = useAction(api.github.commitFile);
  const importRepo = useAction(api.github.importRepo);

  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [pushProgress, setPushProgress] = useState({ done: 0, total: 0 });
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const repo = activeProject?.githubRepo;
  const isConnected = githubSettings?.connected;

  const handlePush = async () => {
    if (!repo || !allFiles || !projectId) return;
    const msg = commitMessage.trim() || `CodeForge update — ${new Date().toLocaleString()}`;
    setIsPushing(true);
    const filesToPush = allFiles.filter((f: NonNullable<typeof allFiles>[number]) => !f.isDirectory && f.content);
    setPushProgress({ done: 0, total: filesToPush.length });
    let successCount = 0, failCount = 0;
    for (let i = 0; i < filesToPush.length; i++) {
      const file = filesToPush[i];
      try {
        const result = await commitFile({
          repo,
          path: file.path,
          content: file.content || "",
          message: `${msg}\n\nFile: ${file.path}`,
        });
        if (result.success) successCount++;
        else { failCount++; console.error(`Failed: ${file.path}`, result.error); }
      } catch (e) {
        failCount++;
      }
      setPushProgress({ done: i + 1, total: filesToPush.length });
    }
    setIsPushing(false);
    setCommitMessage("");
    if (failCount === 0) toast.success(`Pushed ${successCount} files to ${repo}`);
    else toast.error(`Pushed ${successCount} files, ${failCount} failed`);
  };

  const handlePull = async () => {
    if (!repo || !projectId) return;
    setIsPulling(true);
    try {
      const result = await importRepo({ projectId, repo });
      if (result.success) toast.success(`Pulled ${result.fileCount} files from ${repo}`);
      else toast.error(result.error || "Failed to pull from GitHub");
    } catch {
      toast.error("Failed to pull from GitHub");
    }
    setIsPulling(false);
  };

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-4 bg-[#0a0a0f]">
        <p className="text-xs text-white/30">Select a project to view git activity</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] border-l border-white/5">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2 bg-white/[0.02]">
        <GitBranch className="h-4 w-4 text-emerald-400/60" />
        <span className="text-xs font-semibold text-white/70 flex-1">Git</span>
        {isConnected ? (
          <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-400 border-0">
            <Github className="h-2.5 w-2.5 mr-1" />
            {githubSettings?.username || "connected"}
          </Badge>
        ) : (
          <Badge className="text-[9px] h-4 px-1.5 bg-white/5 text-white/30 border-0">
            not connected
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* — NOT CONNECTED — */}
        {!isConnected && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Github className="h-10 w-10 text-white/10" />
            <div className="text-center">
              <p className="text-xs text-white/40 font-medium">GitHub not connected</p>
              <p className="text-[10px] text-white/20 mt-1">Add your GitHub token to enable push/pull and repo import</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 h-8 text-xs border-white/10"
              onClick={() => setShowConnectDialog(true)}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Connect GitHub
            </Button>
          </div>
        )}

        {/* — CONNECTED — */}
        {isConnected && (
          <>
            {/* Action buttons row */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-7 text-xs gap-1.5 border-white/10"
                onClick={() => setShowImportDialog(true)}
              >
                <FolderDown className="h-3 w-3" />
                Import Repo
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1.5 text-white/40"
                onClick={() => setShowConnectDialog(true)}
                title="Re-connect / change token"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>

            {/* Linked repo sync */}
            {repo ? (
              <div className="rounded-lg border border-white/5 p-3 bg-white/[0.02] space-y-3">
                <div className="flex items-center gap-2">
                  <Github className="h-3.5 w-3.5 text-white/40" />
                  <span className="text-[11px] text-white/60 font-mono truncate flex-1">{repo}</span>
                </div>
                <Input
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message (optional)..."
                  className="h-7 text-xs bg-white/5 border-white/10"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs gap-1.5"
                    onClick={handlePush}
                    disabled={isPushing || isPulling || !allFiles?.length}
                  >
                    {isPushing ? (
                      <><Loader2 className="h-3 w-3 animate-spin" />Pushing {pushProgress.done}/{pushProgress.total}</>
                    ) : (
                      <><Upload className="h-3 w-3" />Push</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs gap-1.5 border-white/10"
                    onClick={handlePull}
                    disabled={isPulling || isPushing}
                  >
                    {isPulling ? (
                      <><Loader2 className="h-3 w-3 animate-spin" />Pulling...</>
                    ) : (
                      <><Download className="h-3 w-3" />Pull</>
                    )}
                  </Button>
                </div>
                <div className="text-[10px] text-white/20">
                  {allFiles?.filter((f: NonNullable<typeof allFiles>[number]) => !f.isDirectory).length || 0} files in project
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 p-4 text-center">
                <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-yellow-400/40" />
                <p className="text-[11px] text-white/40">No GitHub repo linked to this project.</p>
                <p className="text-[10px] text-white/20 mt-1">Import a repo to enable push/pull.</p>
              </div>
            )}

            {/* Build session history */}
            <div>
              <div className="text-[10px] text-white/20 uppercase tracking-wider font-semibold mb-2 px-1">
                Build Sessions
              </div>
              {!buildSessions || buildSessions.length === 0 ? (
                <p className="text-center text-[10px] text-white/15 py-4">No sessions yet</p>
              ) : (
                <div className="space-y-1.5">
                  {buildSessions.map((session: NonNullable<typeof buildSessions>[number]) => (
                    <div
                      key={session._id}
                      className={cn(
                        "rounded-lg border border-white/5 p-2.5 bg-white/[0.02]",
                        session.status === "running" && "border-emerald-500/20"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-white/50 truncate flex-1">
                          {(session as any).description?.slice(0, 60) ?? session._id}
                        </span>
                        <Badge
                          className={cn(
                            "text-[8px] h-3.5 px-1 border-0 shrink-0",
                            session.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : session.status === "running"
                              ? "bg-blue-500/10 text-blue-400"
                              : session.status === "error"
                              ? "bg-red-500/10 text-red-400"
                              : "bg-white/5 text-white/40"
                          )}
                        >
                          {session.status === "completed" && <Check className="h-2 w-2 mr-0.5" />}
                          {session.status}
                        </Badge>
                      </div>
                      <div className="text-[9px] text-white/20 mt-1">
                        {new Date(session._creationTime).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      <GitHubConnectDialog
        open={showConnectDialog}
        onOpenChange={setShowConnectDialog}
      />
      <ImportRepoDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        activeProjectId={projectId}
        onSelectProject={(_id) => setShowImportDialog(false)}
      />
    </div>
  );
}
