import { X, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doc } from "../../../convex/_generated/dataModel";

interface EditorTabsProps {
  openFiles: Doc<"files">[];
  activeFilePath: string | null;
  onSelect: (file: Doc<"files">) => void;
  onClose: (filePath: string) => void;
  unsavedFiles: Set<string>;
}

function getTabIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "html":
    case "htm":
      return "text-orange-400";
    case "css":
      return "text-blue-400";
    case "js":
    case "jsx":
      return "text-yellow-400";
    case "ts":
    case "tsx":
      return "text-blue-300";
    case "json":
      return "text-green-400";
    case "py":
      return "text-green-300";
    default:
      return "text-gray-400";
  }
}

export function EditorTabs({
  openFiles,
  activeFilePath,
  onSelect,
  onClose,
  unsavedFiles,
}: EditorTabsProps) {
  if (openFiles.length === 0) return null;

  return (
    <div className="flex items-center bg-[oklch(0.11_0.02_260)] border-b border-border overflow-x-auto">
      {openFiles.map((file) => {
        const isActive = activeFilePath === file.path;
        const isUnsaved = unsavedFiles.has(file.path);
        return (
          <div
            key={file.path}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-border text-sm whitespace-nowrap group",
              isActive
                ? "bg-[oklch(0.13_0.02_260)] text-foreground border-t-2 border-t-[oklch(0.75_0.18_190)]"
                : "bg-[oklch(0.11_0.02_260)] text-muted-foreground hover:text-foreground hover:bg-[oklch(0.14_0.02_260)] border-t-2 border-t-transparent"
            )}
            onClick={() => onSelect(file)}
          >
            <FileCode className={cn("h-3.5 w-3.5", getTabIcon(file.name))} />
            <span>{file.name}</span>
            {isUnsaved && (
              <span className="w-2 h-2 rounded-full bg-[oklch(0.75_0.18_190)]" />
            )}
            <button
              type="button"
              className="ml-1 p-0.5 opacity-0 group-hover:opacity-100 hover:bg-[oklch(0.22_0.02_260)] rounded transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onClose(file.path);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
