import { useState, useEffect } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Github,
  Loader2,
  Search,
  Lock,
  Globe,
  Star,
  Download,
} from "lucide-react";

interface Repo {
  fullName: string;
  name: string;
  description: string | null;
  language: string | null;
  updatedAt: string;
  isPrivate: boolean;
  defaultBranch: string;
  stars: number;
  size: number;
}

export function ImportRepoDialog({
  open,
  onOpenChange,
  activeProjectId: _activeProjectId,
  onSelectProject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeProjectId: Id<"projects"> | null;
  onSelectProject: (id: Id<"projects">) => void;
}) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const listRepos = useAction(api.github.listRepos);
  const importRepo = useAction(api.github.importRepo);
  const createProject = useMutation(api.projects.create);

  useEffect(() => {
    if (open && repos.length === 0) {
      loadRepos();
    }
  }, [open]);

  const loadRepos = async () => {
    setIsLoading(true);
    try {
      const result = await listRepos({});
      setRepos(result);
    } catch (e) {
      toast.error("Failed to load repos");
    }
    setIsLoading(false);
  };

  const handleImport = async (repo: Repo) => {
    setIsImporting(repo.fullName);
    try {
      // Create a new project for this repo
      const projectId = await createProject({
        name: repo.name,
        description: repo.description || undefined,
        githubRepo: repo.fullName,
      });

      // Import files
      const result = await importRepo({
        projectId,
        repo: repo.fullName,
        branch: repo.defaultBranch,
      });

      if (result.success) {
        toast.success(`Imported ${result.fileCount} files from ${repo.name}`);
        onSelectProject(projectId);
        onOpenChange(false);
      } else {
        toast.error(result.error || "Import failed");
      }
    } catch (e) {
      toast.error("Failed to import repo");
    }
    setIsImporting(null);
  };

  const filtered = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (r.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const langColors: Record<string, string> = {
    TypeScript: "bg-blue-500",
    JavaScript: "bg-yellow-500",
    Python: "bg-green-500",
    Rust: "bg-orange-500",
    Go: "bg-cyan-500",
    Java: "bg-red-500",
    HTML: "bg-red-400",
    CSS: "bg-purple-500",
    "C++": "bg-pink-500",
    C: "bg-gray-500",
    Ruby: "bg-red-600",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Import Repository
          </DialogTitle>
          <DialogDescription>
            Select a repository to import into CodeForge.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search repos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((repo) => (
                <div
                  key={repo.fullName}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {repo.isPrivate ? (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Globe className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium truncate">
                        {repo.name}
                      </span>
                      {repo.stars > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Star className="h-2.5 w-2.5" />
                          {repo.stars}
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-[11px] text-muted-foreground truncate mb-1">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {repo.language && (
                        <span className="flex items-center gap-1">
                          <span
                            className={`h-2 w-2 rounded-full ${langColors[repo.language] || "bg-gray-400"}`}
                          />
                          {repo.language}
                        </span>
                      )}
                      <span>{repo.fullName}</span>
                      <span>
                        {(repo.size / 1024).toFixed(0)}MB
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 shrink-0"
                    onClick={() => handleImport(repo)}
                    disabled={isImporting !== null}
                  >
                    {isImporting === repo.fullName ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    Import
                  </Button>
                </div>
              ))}
              {filtered.length === 0 && !isLoading && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No repos found
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
