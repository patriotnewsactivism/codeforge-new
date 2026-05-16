/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — PROJECT EXPORT (ZIP)
 * ═══════════════════════════════════════════════════════════════════
 *
 * One-click download of an entire project as a .zip file.
 * Preserves directory structure.
 */
import type { Id } from "../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface ExportButtonProps {
  projectId: Id<"projects"> | null;
  projectName?: string;
  className?: string;
  variant?: "ghost" | "outline" | "default";
  size?: "sm" | "default" | "lg";
  showLabel?: boolean;
}

export function ExportButton({
  projectId,
  projectName,
  className,
  variant = "ghost",
  size = "sm",
  showLabel = false,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [done, setDone] = useState(false);

  const files = useQuery(
    api.files.listByProject,
    projectId ? { projectId } : "skip"
  );

  const handleExport = useCallback(async () => {
    if (!files || files.length === 0) {
      toast.error("No files to export");
      return;
    }

    setIsExporting(true);
    try {
      // Dynamic import to avoid loading JSZip until needed
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      let fileCount = 0;
      for (const file of files) {
        if (!file.isDirectory && file.content != null) {
          // Normalize path — remove leading slash
          const path = file.path.startsWith("/")
            ? file.path.slice(1)
            : file.path;
          zip.file(path, file.content);
          fileCount++;
        }
      }

      if (fileCount === 0) {
        toast.error("No file contents to export");
        setIsExporting(false);
        return;
      }

      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      // Download
      const safeName = (projectName || "project")
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, "-")
        .replace(/-+/g, "-");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${fileCount} files`);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch (e) {
      console.error("Export failed:", e);
      toast.error("Export failed");
    }
    setIsExporting(false);
  }, [files, projectName]);

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleExport}
      disabled={isExporting || !projectId}
      title="Download project as ZIP"
    >
      {isExporting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : done ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {showLabel && (
        <span className="ml-1">
          {isExporting ? "Exporting..." : done ? "Done!" : "Export ZIP"}
        </span>
      )}
    </Button>
  );
}
