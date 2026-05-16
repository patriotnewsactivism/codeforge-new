import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FileTree } from "@/components/ide/FileTree";
import { CodeEditor } from "@/components/ide/CodeEditor";
import { EditorTabs } from "@/components/ide/EditorTabs";
import { ChatPanel } from "@/components/ide/ChatPanel";
import { LivePreview } from "@/components/ide/LivePreview";
import { CollaborationBar } from "@/components/ide/CollaborationBar";
import { SuggestionsPanel } from "@/components/ide/SuggestionsPanel";
import { BuildProgress } from "@/components/ide/BuildProgress";
import { AgentPanel } from "@/components/ide/AgentPanel";
import { MemoryTab } from "@/components/ide/MemoryTab";
import { AgentActivityPanel } from "@/components/ide/AgentActivityPanel";
import { GitPanel } from "@/components/ide/GitPanel";
import { PanelErrorBoundary } from "@/components/ide/PanelErrorBoundary";
import { CostBar } from "@/components/ide/CostBar";
import { ImportRepoDialog } from "@/components/ide/ImportRepoDialog";
import { DiffViewer } from "@/components/ide/DiffViewer";
import { DeployPanel } from "@/components/ide/DeployPanel";
import { GitHubConnectDialog } from "@/components/ide/GitHubConnectDialog";
import {
  FileTreeSkeleton,
  EditorSkeleton,
} from "@/components/ide/PanelSkeleton";
import { useAuthToken } from "@/hooks/useAuthToken";
import { toast } from "sonner";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  MessageSquare,
  Lightbulb,
  Zap,
  Brain,
  Cpu,
  Github,
  FolderOpen,
  Code2,
  Eye,
  Save,
  X,
} from "lucide-react";

// Mobile breakpoint: anything below 768px is "mobile"
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

type RightPanel = "chat" | "suggestions" | "agents" | "memory" | "thoughts" | "git" | "diff" | "deploy";
// Mobile views: one panel visible at a time
type MobileView = "files" | "editor" | "preview" | "panel";

export function IDEPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const userId = useAuthToken();
  const isMobile = useIsMobile();

  const project = useQuery(
    api.projects.get,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const files = useQuery(
    api.files.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const collaborators = useQuery(
    api.collaboration.listActive,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  const updateFileContent = useMutation(api.files.updateContent);
  const createFile = useMutation(api.files.create);
  const deleteFile = useMutation(api.files.remove);
  const getOrCreateSession = useMutation(api.chat.getOrCreateSession);
  const heartbeat = useMutation(api.collaboration.heartbeat);
  const generateSuggestions = useAction(api.suggestions.generateSuggestions);
  const runAutonomousCycle = useAction(api.suggestions.runAutonomousCycle);

  const [openFilePaths, setOpenFilePaths] = useState<string[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [fileBuffers, setFileBuffers] = useState<Map<string, string>>(new Map());
  const [unsavedFiles, setUnsavedFiles] = useState<Set<string>>(new Set());
  const [sessionId, setSessionId] = useState<Id<"chatSessions"> | null>(null);
  const [showPreview, _setShowPreview] = useState(true);
  const [rightPanel, setRightPanel] = useState<RightPanel>("chat");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showGitHubConnect, setShowGitHubConnect] = useState(false);
  const [showRightPanel, _setShowRightPanel] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [_showSessionSidebar, _setShowSessionSidebar] = useState(false);

  // Mobile-specific state
  const [mobileView, setMobileView] = useState<MobileView>("editor");
  const [mobileFileDrawer, setMobileFileDrawer] = useState(false);

  // Initialize chat session
  useEffect(() => {
    if (projectId && userId && !sessionId) {
      getOrCreateSession({ projectId: projectId as Id<"projects"> }).then(setSessionId);
    }
  }, [projectId, userId, sessionId, getOrCreateSession]);

  // Presence heartbeat
  useEffect(() => {
    if (!projectId) return;
    const interval = setInterval(() => {
      heartbeat({
        projectId: projectId as Id<"projects">,
        activeFile: activeFilePath ?? undefined,
      }).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, [projectId, activeFilePath, heartbeat]);

  // Auto-open first file
  useEffect(() => {
    if (files && files.length > 0 && openFilePaths.length === 0) {
      const htmlFile = files.find((f: NonNullable<typeof files>[number]) => f.name === "index.html");
      const firstFile = htmlFile ?? files.find((f: NonNullable<typeof files>[number]) => !f.isDirectory);
      if (firstFile) {
        setOpenFilePaths([firstFile.path]);
        setActiveFilePath(firstFile.path);
      }
    }
  }, [files, openFilePaths.length]);

  // Auto-generate suggestions on first load, and run autonomous cycle if enabled
  useEffect(() => {
    if (!projectId || files === undefined || files.length === 0) return;
    // Fire-and-forget: generate suggestions in background
    generateSuggestions({ projectId: projectId as Id<"projects"> }).catch(() => {});
  }, [projectId, files?.length]);

  // Autonomous mode: run a build cycle every autoIntervalMinutes
  const autonomousSettings = useQuery(
    api.suggestions.getAutonomousMode,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  useEffect(() => {
    if (!projectId || !autonomousSettings?.autonomousMode) return;
    const intervalMs = (autonomousSettings.autoIntervalMinutes ?? 15) * 60 * 1000;
    const timer = setInterval(() => {
      runAutonomousCycle({ projectId: projectId as Id<"projects"> }).catch(() => {});
    }, intervalMs);
    return () => clearInterval(timer);
  }, [projectId, autonomousSettings?.autonomousMode, autonomousSettings?.autoIntervalMinutes]);


  const activeFile = files?.find((f: NonNullable<typeof files>[number]) => f.path === activeFilePath) ?? null;

  const getFileContent = useCallback(
    (path: string) =>
      fileBuffers.get(path) ??
      files?.find((f: NonNullable<typeof files>[number]) => f.path === path)?.content ??
      "",
    [fileBuffers, files]
  );

  const handleFileSelect = useCallback(
    (file: Doc<"files">) => {
      if (!openFilePaths.includes(file.path)) {
        setOpenFilePaths((prev) => [...prev, file.path]);
      }
      setActiveFilePath(file.path);
      // On mobile: auto-navigate to editor after picking a file
      if (isMobile) {
        setMobileView("editor");
        setMobileFileDrawer(false);
      }
    },
    [openFilePaths, isMobile]
  );

  const handleTabClose = useCallback(
    (filePath: string) => {
      setOpenFilePaths((prev) => prev.filter((p) => p !== filePath));
      if (activeFilePath === filePath) {
        const remaining = openFilePaths.filter((p) => p !== filePath);
        setActiveFilePath(remaining.length > 0 ? remaining[remaining.length - 1]! : null);
      }
      setFileBuffers((prev) => {
        const next = new Map(prev);
        next.delete(filePath);
        return next;
      });
      setUnsavedFiles((prev) => {
        const next = new Set(prev);
        next.delete(filePath);
        return next;
      });
    },
    [activeFilePath, openFilePaths]
  );

  const handleContentChange = useCallback(
    (content: string) => {
      if (!activeFilePath) return;
      setFileBuffers((prev) => new Map(prev).set(activeFilePath, content));
      const original = files?.find((f: NonNullable<typeof files>[number]) => f.path === activeFilePath)?.content;
      if (content !== original) {
        setUnsavedFiles((prev) => new Set(prev).add(activeFilePath));
      } else {
        setUnsavedFiles((prev) => {
          const next = new Set(prev);
          next.delete(activeFilePath);
          return next;
        });
      }
    },
    [activeFilePath, files]
  );

  const handleSave = useCallback(async () => {
    if (!activeFilePath || !activeFile) return;
    const content = fileBuffers.get(activeFilePath);
    if (content === undefined) return;
    try {
      await updateFileContent({ fileId: activeFile._id, content });
      setUnsavedFiles((prev) => {
        const next = new Set(prev);
        next.delete(activeFilePath);
        return next;
      });
      setFileBuffers((prev) => {
        const next = new Map(prev);
        next.delete(activeFilePath);
        return next;
      });
      toast.success("Saved", { duration: 1000 });
    } catch {
      toast.error("Failed to save");
    }
  }, [activeFilePath, activeFile, fileBuffers, updateFileContent]);

  // Keyboard shortcut: Ctrl+S / Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  const handleCreateFile = useCallback(
    async (path: string, isDirectory: boolean) => {
      if (!projectId) return;
      const parts = path.split("/");
      const name = parts[parts.length - 1] ?? path;
      try {
        await createFile({
          projectId: projectId as Id<"projects">,
          path,
          name,
          content: isDirectory ? "" : "",
          isDirectory,
          parentPath: parts.slice(0, -1).join("/") || undefined,
        });
        if (!isDirectory) {
          setOpenFilePaths((prev) => [...prev, path]);
          setActiveFilePath(path);
        }
      } catch (e) {
        toast.error("Failed to create file");
      }
    },
    [projectId, createFile]
  );

  const handleDeleteFile = useCallback(
    async (fileId: Id<"files">, filePath: string) => {
      try {
        await deleteFile({ fileId });
        handleTabClose(filePath);
        toast.success("Deleted");
      } catch {
        toast.error("Failed to delete");
      }
    },
    [deleteFile, handleTabClose]
  );


  const handleImplementSuggestion = useCallback(
    async (suggestion: { targetFile: string; content: string }) => {
      if (!projectId) return;
      const file = files?.find((f: NonNullable<typeof files>[number]) => f.path === suggestion.targetFile);
      if (!file) return;
      setFileBuffers((prev) => new Map(prev).set(suggestion.targetFile, suggestion.content));
      setUnsavedFiles((prev) => new Set(prev).add(suggestion.targetFile));
      if (!openFilePaths.includes(suggestion.targetFile)) {
        setOpenFilePaths((prev) => [...prev, suggestion.targetFile]);
      }
      setActiveFilePath(suggestion.targetFile);
    },
    [projectId, files, openFilePaths]
  );

  const openFilesDocs = (files ?? []).filter((f: NonNullable<typeof files>[number]) => openFilePaths.includes(f.path));
  const openFileContexts = openFilesDocs.map((f: NonNullable<typeof files>[number]) => ({
    path: f.path,
    content: getFileContent(f.path),
  }));
  const previewFiles = (files ?? []).filter((f: NonNullable<typeof files>[number]) => !f.isDirectory);

  if (!projectId || project === undefined) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  // ─── RIGHT PANEL CONTENT (shared between mobile and desktop) ────────────────
  const panelTabs: Array<{ id: RightPanel; label: string; icon: React.ReactNode; color: string }> = [
    { id: "chat", label: "Chat", icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-primary border-primary" },
    { id: "suggestions", label: "Ideas", icon: <Lightbulb className="h-3.5 w-3.5" />, color: "text-amber-400 border-amber-400" },
    { id: "agents", label: "Agents", icon: <Zap className="h-3.5 w-3.5" />, color: "text-amber-400 border-amber-400" },
    { id: "memory", label: "Memory", icon: <Brain className="h-3.5 w-3.5" />, color: "text-violet-400 border-violet-400" },
    { id: "thoughts", label: "Activity", icon: <Cpu className="h-3.5 w-3.5" />, color: "text-cyan-400 border-cyan-400" },
    { id: "git", label: "Git", icon: <Github className="h-3.5 w-3.5" />, color: "text-orange-400 border-orange-400" },
    { id: "diff", label: "Diff", icon: <Code2 className="h-3.5 w-3.5" />, color: "text-rose-400 border-rose-400" },
    { id: "deploy", label: "Deploy", icon: <Zap className="h-3.5 w-3.5" />, color: "text-green-400 border-green-400" },
  ];

  const rightPanelContent = (
    <div className="h-full flex flex-col">
      {/* Tab bar — horizontally scrollable on mobile */}
      <div className="flex border-b border-border bg-[oklch(0.10_0.02_260)] overflow-x-auto scrollbar-none shrink-0">
        {panelTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setRightPanel(tab.id)}
            className={`flex items-center gap-1 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap transition-colors shrink-0 ${
              rightPanel === tab.id
                ? `${tab.color} border-b-2`
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {rightPanel === "chat" && (
          <PanelErrorBoundary panelName="AI Chat">
            <ChatPanel
              projectId={projectId as Id<"projects">}
              sessionId={sessionId}
              currentFileContent={activeFile ? getFileContent(activeFile.path) : undefined}
              currentFileName={activeFile?.name}
              openFiles={openFileContexts}
            />
          </PanelErrorBoundary>
        )}
        {rightPanel === "suggestions" && (
          <PanelErrorBoundary panelName="Suggestions">
            <SuggestionsPanel
              projectId={projectId as Id<"projects">}
              onImplement={handleImplementSuggestion}
            />
          </PanelErrorBoundary>
        )}
        {rightPanel === "agents" && (
          <PanelErrorBoundary panelName="Multi-Agent">
            <AgentPanel projectId={projectId as Id<"projects">} />
          </PanelErrorBoundary>
        )}
        {rightPanel === "memory" && (
          <PanelErrorBoundary panelName="Memory">
            <MemoryTab projectId={projectId as Id<"projects">} />
          </PanelErrorBoundary>
        )}
        {rightPanel === "thoughts" && (
          <PanelErrorBoundary panelName="Agent Activity">
            <AgentActivityPanel projectId={projectId as Id<"projects">} />
          </PanelErrorBoundary>
        )}
        {rightPanel === "git" && (
          <PanelErrorBoundary panelName="Git">
            <GitPanel projectId={projectId as Id<"projects">} />
          </PanelErrorBoundary>
        )}
        {rightPanel === "diff" && (
          <PanelErrorBoundary panelName="Diff Viewer">
            <DiffViewer projectId={projectId as Id<"projects">} />
          </PanelErrorBoundary>
        )}
        {rightPanel === "deploy" && (
          <PanelErrorBoundary panelName="Deploy">
            <DeployPanel projectId={projectId as Id<"projects">} />
          </PanelErrorBoundary>
        )}
      </div>
    </div>
  );

  // ─── MOBILE LAYOUT ────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex items-center gap-2 px-3 h-11 border-b border-border bg-[oklch(0.09_0.02_260)] shrink-0">
          <button
            type="button"
            onClick={() => setMobileFileDrawer(true)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 active:bg-white/10"
            aria-label="Files"
          >
            <FolderOpen className="h-4 w-4" />
          </button>
          <p className="flex-1 text-[11px] font-medium truncate text-foreground">
            {activeFilePath?.split("/").pop() ?? project.name}
            {unsavedFiles.has(activeFilePath ?? "") && (
              <span className="ml-1 text-amber-400">●</span>
            )}
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={!unsavedFiles.has(activeFilePath ?? "")}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 active:bg-white/10"
            aria-label="Save"
          >
            <Save className="h-4 w-4" />
          </button>
        </div>

        <BuildProgress projectId={projectId as Id<"projects">} />

        {/* Main content area — full height minus top bar and bottom nav */}
        <div className="flex-1 overflow-hidden relative">
          {mobileView === "editor" && (
            <div className="h-full flex flex-col">
              {openFilesDocs.length > 1 && (
                <div className="shrink-0 overflow-x-auto scrollbar-none">
                  <EditorTabs
                    openFiles={openFilesDocs}
                    activeFilePath={activeFilePath}
                    onSelect={handleFileSelect}
                    onClose={handleTabClose}
                    unsavedFiles={unsavedFiles}
                  />
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <PanelErrorBoundary panelName="Code Editor">
                  {files === undefined ? (
                    <EditorSkeleton />
                  ) : (
                    <CodeEditor
                      file={activeFile ? { ...activeFile, content: getFileContent(activeFile.path) } : null}
                      onChange={handleContentChange}
                      onSave={handleSave}
                    />
                  )}
                </PanelErrorBoundary>
              </div>
            </div>
          )}

          {mobileView === "preview" && (
            <PanelErrorBoundary panelName="Live Preview">
              <LivePreview
                files={previewFiles}
                autoRefresh={autoRefresh}
                onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
              />
            </PanelErrorBoundary>
          )}

          {mobileView === "panel" && (
            <div className="h-full">
              {rightPanelContent}
            </div>
          )}
        </div>

        {/* Mobile bottom nav — 4 big touch targets */}
        <div className="shrink-0 grid grid-cols-4 border-t border-border bg-[oklch(0.09_0.02_260)]">
          {[
            { view: "editor" as MobileView, icon: <Code2 className="h-5 w-5" />, label: "Code" },
            { view: "preview" as MobileView, icon: <Eye className="h-5 w-5" />, label: "Preview" },
            { view: "panel" as MobileView, icon: <MessageSquare className="h-5 w-5" />, label: "Chat" },
            { view: "panel" as MobileView, icon: <Zap className="h-5 w-5" />, label: "Agents", panel: "agents" as RightPanel },
          ].map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setMobileView(item.view);
                if (item.panel) setRightPanel(item.panel);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-colors active:bg-white/5 ${
                mobileView === item.view
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {item.icon}
              <span className="text-[9px] font-semibold uppercase tracking-wider">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Mobile file drawer overlay */}
        {mobileFileDrawer && (
          <div className="absolute inset-0 z-50 flex">
            <div
              className="flex-1 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileFileDrawer(false)}
            />
            <div className="w-72 max-w-[85vw] h-full bg-[oklch(0.10_0.02_260)] border-l border-border flex flex-col">
              <div className="flex items-center justify-between px-4 h-11 border-b border-border shrink-0">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Files</span>
                <button
                  type="button"
                  onClick={() => setMobileFileDrawer(false)}
                  className="p-1.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <PanelErrorBoundary panelName="File Tree">
                  {files === undefined ? (
                    <FileTreeSkeleton />
                  ) : (
                    <FileTree
                      files={files}
                      activeFilePath={activeFilePath}
                      onFileSelect={handleFileSelect}
                      onCreateFile={(name: string) => void handleCreateFile(name, false)}
                      onDeleteFile={(fileId) => void handleDeleteFile(fileId, "")}
                      collaborators={collaborators}
                    />
                  )}
                </PanelErrorBoundary>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ───────────────────────────────────────────────────────────
  return (
    <>
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <CollaborationBar
        projectId={projectId as Id<"projects">}
        projectName={project.name}
      />
      <BuildProgress projectId={projectId as Id<"projects">} />
      <CostBar projectId={projectId as Id<"projects">} />

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* File Tree */}
          <ResizablePanel defaultSize={15} minSize={10} maxSize={25}>
            <PanelErrorBoundary panelName="File Tree">
              {files === undefined ? (
                <FileTreeSkeleton />
              ) : (
                <FileTree
                  files={files}
                  activeFilePath={activeFilePath}
                  onFileSelect={handleFileSelect}
                  onCreateFile={(name: string) => void handleCreateFile(name, false)}
                  onDeleteFile={(fileId) => void handleDeleteFile(fileId, "")}
                  collaborators={collaborators}
                />
              )}
            </PanelErrorBoundary>
          </ResizablePanel>

          <ResizableHandle />

          {/* Editor + Preview */}
          <ResizablePanel defaultSize={showRightPanel ? 55 : 70}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={showPreview ? 55 : 100}>
                <div className="h-full flex flex-col">
                  <EditorTabs
                    openFiles={openFilesDocs}
                    activeFilePath={activeFilePath}
                    onSelect={handleFileSelect}
                    onClose={handleTabClose}
                    unsavedFiles={unsavedFiles}
                  />
                  <div className="flex-1 overflow-hidden">
                    <PanelErrorBoundary panelName="Code Editor">
                      {files === undefined ? (
                        <EditorSkeleton />
                      ) : (
                        <CodeEditor
                          file={activeFile ? { ...activeFile, content: getFileContent(activeFile.path) } : null}
                          onChange={handleContentChange}
                          onSave={handleSave}
                        />
                      )}
                    </PanelErrorBoundary>
                  </div>
                </div>
              </ResizablePanel>

              {showPreview && (
                <>
                  <ResizableHandle />
                  <ResizablePanel defaultSize={45} minSize={20}>
                    <PanelErrorBoundary panelName="Live Preview">
                      <LivePreview
                        files={previewFiles}
                        autoRefresh={autoRefresh}
                        onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
                      />
                    </PanelErrorBoundary>
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          {showRightPanel && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={30} minSize={20} maxSize={45}>
                {rightPanelContent}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>

      {/* GitHub Dialogs */}
      <ImportRepoDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        activeProjectId={projectId as Id<"projects"> | null}
        onSelectProject={(_id) => setShowImportDialog(false)}
      />
      <GitHubConnectDialog
        open={showGitHubConnect}
        onOpenChange={setShowGitHubConnect}
      />
    </>
  );
}
