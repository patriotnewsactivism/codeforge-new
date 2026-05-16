import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus, FolderOpen, Trash2, Clock, Code2, Sparkles,
  Github, Download, Loader2, CheckCircle2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";

type ModalMode = "none" | "create" | "import";

export function DashboardPage() {
  const projects = useQuery(api.projects.list) ?? [];
  const createProject = useMutation(api.projects.create);
  const removeProject = useMutation(api.projects.remove);
  const importFromGitHub = useAction(api.git.importFromGitHub);
  const navigate = useNavigate();

  // Create state
  const [modal, setModal] = useState<ModalMode>("none");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Import state
  const [repoUrl, setRepoUrl] = useState("");
  const [importName, setImportName] = useState("");
  const [importStatus, setImportStatus] = useState<"idle" | "importing" | "done" | "error">("idle");
  const [importMsg, setImportMsg] = useState("");

  const closeModal = () => {
    setModal("none");
    setNewProjectName("");
    setNewProjectDesc("");
    setRepoUrl("");
    setImportName("");
    setImportStatus("idle");
    setImportMsg("");
  };

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      const projectId = await createProject({
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || undefined});
      toast.success(`Created ${newProjectName}`);
      closeModal();
      navigate(`/project/${projectId}`);
    } catch {
      toast.error("Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  // Parse owner/repo from any GitHub URL format or "owner/repo"
  const parseRepo = (input: string): string | null => {
    input = input.trim();
    // "owner/repo" short form
    if (/^[\w.-]+\/[\w.-]+$/.test(input)) return input;
    // Full URL: https://github.com/owner/repo(.git)?
    const match = input.match(/github\.com\/([^/]+\/[^/\s]+?)(?:\.git)?(?:\/.*)?$/);
    return match ? match[1]! : null;
  };

  const handleImport = async () => {
    const repoFullName = parseRepo(repoUrl);
    if (!repoFullName) {
      toast.error("Enter a valid GitHub URL or owner/repo");
      return;
    }
    const name = importName.trim() || repoFullName.split("/")[1] || repoFullName;

    setImportStatus("importing");
    setImportMsg("Creating project...");

    try {
      // Create project first — store githubRepo so re-sync works
      const projectId = await createProject({
        name,
        description: `Imported from github.com/${repoFullName}`,
        githubRepo: repoFullName});

      setImportMsg(`Fetching files from ${repoFullName}...`);

      // Import files
      const result = await importFromGitHub({
        projectId,
        repoFullName});

      if (!result.success) {
        setImportStatus("error");
        setImportMsg(result.error ?? "Import failed");
        // Clean up the empty project
        await removeProject({ projectId });
        return;
      }

      setImportStatus("done");
      setImportMsg(`Imported ${result.filesImported} files successfully`);

      setTimeout(() => {
        closeModal();
        navigate(`/project/${projectId}`);
      }, 1200);
    } catch (e) {
      setImportStatus("error");
      setImportMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async (projectId: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await removeProject({ projectId: projectId as Id<"projects"> });
      toast.success(`Deleted ${name}`);
    } catch {
      toast.error("Failed to delete project");
    }
  };

  const sortedProjects = [...projects].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);

  return (
    <div className="min-h-[calc(100dvh-64px)] p-3 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Code2 className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
              Your Projects
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Create, manage, and code with AI assistance
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2 flex-1 sm:flex-none"
              onClick={() => setModal("import")}
            >
              <Github className="h-4 w-4" />
              Import Repo
            </Button>
            <Button
              className="gap-2 flex-1 sm:flex-none"
              onClick={() => setModal("create")}
            >
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </div>
        </div>

        {/* Projects grid */}
        {sortedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No projects yet</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Create a new project or import an existing repo from GitHub
            </p>
            <div className="flex gap-2 flex-wrap justify-center">
              <Button variant="outline" onClick={() => setModal("import")} className="gap-2">
                <Github className="h-4 w-4" /> Import from GitHub
              </Button>
              <Button onClick={() => setModal("create")} className="gap-2">
                <Plus className="h-4 w-4" /> Create Project
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {sortedProjects.map((project) => (
              <Card
                key={project._id}
                className="group cursor-pointer hover:border-primary/50 transition-colors bg-card active:scale-[0.98]"
                onClick={() => navigate(`/project/${project._id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {project.githubRepo
                        ? <Github className="h-4 w-4 text-primary shrink-0" />
                        : <FolderOpen className="h-4 w-4 text-primary shrink-0" />}
                      <CardTitle className="text-sm sm:text-base truncate">
                        {project.name}
                      </CardTitle>
                    </div>
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all shrink-0"
                      onClick={(e) => handleDelete(project._id, project.name, e)}
                      aria-label="Delete project"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                  {project.description && (
                    <CardDescription className="text-xs line-clamp-2">
                      {project.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" />
                      {formatTimeAgo(project.lastOpenedAt)}
                    </div>
                    {project.githubRepo && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 truncate">
                        <Github className="h-2.5 w-2.5 shrink-0" />
                        {project.githubRepo}
                      </span>
                    )}
                    {project.language && (
                      <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] shrink-0">
                        {project.language}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── CREATE PROJECT MODAL ── */}
      <Dialog open={modal === "create"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Start a new project with HTML, CSS, and JavaScript starter files.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                placeholder="my-awesome-project"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description (optional)</Label>
              <Input
                id="desc"
                placeholder="A brief description"
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newProjectName.trim() || creating}>
              {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</> : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── IMPORT FROM GITHUB MODAL ── */}
      <Dialog open={modal === "import"} onOpenChange={(o) => !o && importStatus !== "importing" && closeModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" /> Import from GitHub
            </DialogTitle>
            <DialogDescription>
              Paste a GitHub repo URL or enter <code className="text-primary">owner/repo</code>
            </DialogDescription>
          </DialogHeader>

          {importStatus === "idle" && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="repo-url">Repository URL or owner/repo</Label>
                <Input
                  id="repo-url"
                  placeholder="https://github.com/owner/repo  or  owner/repo"
                  value={repoUrl}
                  onChange={(e) => {
                    setRepoUrl(e.target.value);
                    // Auto-fill name from URL
                    const parsed = parseRepo(e.target.value);
                    if (parsed && !importName) {
                      setImportName(parsed.split("/")[1] ?? "");
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-name">Project name (optional)</Label>
                <Input
                  id="import-name"
                  placeholder="Auto-detected from repo"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                />
              </div>
              <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300 space-y-1">
                <p className="font-semibold">What gets imported:</p>
                <p>Code files up to 100KB each — TypeScript, JavaScript, Python, Go, Rust, CSS, HTML, JSON, Markdown, and 20+ more extensions. Up to 250 files. Excludes node_modules and .git.</p>
              </div>
            </div>
          )}

          {importStatus === "importing" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm font-medium">{importMsg}</p>
              <p className="text-xs text-muted-foreground">This may take a moment for large repos...</p>
            </div>
          )}

          {importStatus === "done" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2 className="h-10 w-10 text-green-400" />
              <p className="text-sm font-medium text-green-300">{importMsg}</p>
              <p className="text-xs text-muted-foreground">Redirecting to editor...</p>
            </div>
          )}

          {importStatus === "error" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <AlertCircle className="h-10 w-10 text-red-400" />
                <p className="text-sm font-medium text-red-300">Import failed</p>
                <p className="text-xs text-muted-foreground text-center">{importMsg}</p>
              </div>
              <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-300">
                <p className="font-semibold mb-1">Common causes:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Private repo — add a GitHub token in project settings</li>
                  <li>Repo doesn't exist or the URL is wrong</li>
                  <li>GitHub API rate limit hit — try again in a few minutes</li>
                  <li>Repo has no code files matching supported extensions</li>
                </ul>
              </div>
            </div>
          )}

          {(importStatus === "idle" || importStatus === "error") && (
            <DialogFooter>
              <Button variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button
                onClick={() => { setImportStatus("idle"); setImportMsg(""); }}
                style={{ display: importStatus === "error" ? "flex" : "none" }}
                variant="outline"
              >
                Try Again
              </Button>
              {importStatus === "idle" && (
                <Button onClick={handleImport} disabled={!repoUrl.trim()}>
                  <Download className="h-4 w-4 mr-2" /> Import Repo
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
