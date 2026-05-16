import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

interface FileTreeProps {
  files: Doc<"files">[];
  activeFilePath: string | null;
  onFileSelect: (file: Doc<"files">) => void;
  onCreateFile?: (name: string) => void;
  onDeleteFile?: (fileId: Id<"files">) => void;
  collaborators?: Doc<"collaborators">[];
}

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  file?: Doc<"files">;
  children: TreeNode[];
}

function buildTree(files: Doc<"files">[]): TreeNode[] {
  const root: TreeNode[] = [];

  // Sort: directories first, then by name
  const sorted = [...files].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  for (const file of sorted) {
    const parts = file.path.split("/");
    if (parts.length === 1) {
      root.push({
        name: file.name,
        path: file.path,
        isDirectory: file.isDirectory,
        file: file.isDirectory ? undefined : file,
        children: [],
      });
    }
    // For simplicity, flat file structure for now
  }

  return root;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "html":
    case "htm":
      return <FileCode className="h-4 w-4 text-orange-400" />;
    case "css":
      return <FileCode className="h-4 w-4 text-blue-400" />;
    case "js":
    case "jsx":
      return <FileCode className="h-4 w-4 text-yellow-400" />;
    case "ts":
    case "tsx":
      return <FileCode className="h-4 w-4 text-blue-300" />;
    case "json":
      return <FileJson className="h-4 w-4 text-green-400" />;
    case "md":
      return <FileText className="h-4 w-4 text-gray-400" />;
    case "py":
      return <FileCode className="h-4 w-4 text-green-300" />;
    default:
      return <File className="h-4 w-4 text-gray-400" />;
  }
}

function TreeItem({
  node,
  depth,
  activeFilePath,
  onFileSelect,
  onDeleteFile,
  collaborators,
}: {
  node: TreeNode;
  depth: number;
  activeFilePath: string | null;
  onFileSelect: (file: Doc<"files">) => void;
  onDeleteFile?: (fileId: Id<"files">) => void;
  collaborators?: Doc<"collaborators">[];
}) {
  const [expanded, setExpanded] = useState(true);
  const isActive = activeFilePath === node.path;

  // Find collaborators viewing this file
  const viewingCollabs = collaborators?.filter(
    (c) => c.activeFile === node.path
  );

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 cursor-pointer text-sm hover:bg-[oklch(0.20_0.02_260)] rounded-sm group relative",
          isActive && "bg-[oklch(0.22_0.02_260)] text-[oklch(0.75_0.18_190)]"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (node.isDirectory) {
            setExpanded(!expanded);
          } else if (node.file) {
            onFileSelect(node.file);
          }
        }}
      >
        {node.isDirectory ? (
          expanded ? (
            <>
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              <FolderOpen className="h-4 w-4 shrink-0 text-cyan-400" />
            </>
          ) : (
            <>
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              <Folder className="h-4 w-4 shrink-0 text-cyan-400" />
            </>
          )
        ) : (
          <>
            <span className="w-3" />
            {getFileIcon(node.name)}
          </>
        )}
        <span className="truncate flex-1">{node.name}</span>

        {/* Collaborator dots */}
        {viewingCollabs && viewingCollabs.length > 0 && (
          <div className="flex gap-0.5 mr-1">
            {viewingCollabs.map((c) => (
              <div
                key={c._id}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: c.color }}
                title={c.userName}
              />
            ))}
          </div>
        )}

        {/* Delete button */}
        {onDeleteFile && node.file && (
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFile(node.file!._id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {node.isDirectory && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFilePath={activeFilePath}
              onFileSelect={onFileSelect}
              onDeleteFile={onDeleteFile}
              collaborators={collaborators}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({
  files,
  activeFilePath,
  onFileSelect,
  onCreateFile,
  onDeleteFile,
  collaborators,
}: FileTreeProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  const tree = buildTree(files);

  const handleCreate = () => {
    if (newFileName.trim() && onCreateFile) {
      onCreateFile(newFileName.trim());
      setNewFileName("");
      setIsCreating(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[oklch(0.11_0.02_260)]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Files
        </span>
        <button
          type="button"
          className="p-1 hover:bg-[oklch(0.20_0.02_260)] rounded"
          onClick={() => setIsCreating(!isCreating)}
          title="New file"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {isCreating && (
        <div className="px-2 py-1.5 border-b border-border">
          <input
            type="text"
            className="w-full bg-[oklch(0.18_0.02_260)] border border-border rounded px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="filename.ext"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setIsCreating(false);
                setNewFileName("");
              }
            }}
            autoFocus
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {tree.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            depth={0}
            activeFilePath={activeFilePath}
            onFileSelect={onFileSelect}
            onDeleteFile={onDeleteFile}
            collaborators={collaborators}
          />
        ))}
      </div>
    </div>
  );
}
