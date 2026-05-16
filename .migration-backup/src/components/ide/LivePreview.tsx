import { useEffect, useRef, useState, useCallback } from "react";
import {
  RefreshCw,
  ExternalLink,
  Terminal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doc } from "../../../convex/_generated/dataModel";

interface LivePreviewProps {
  files: Doc<"files">[];
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

interface ConsoleMessage {
  type: "log" | "error" | "warn" | "info";
  content: string;
  timestamp: number;
}

export function LivePreview({
  files,
  autoRefresh,
  onToggleAutoRefresh,
}: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const buildPreviewContent = useCallback(() => {
    const htmlFile = files.find(
      (f) => f.name === "index.html" || f.path.endsWith(".html")
    );
    const cssFile = files.find(
      (f) => f.name === "style.css" || f.path.endsWith(".css")
    );
    const jsFile = files.find(
      (f) => f.name === "script.js" || f.path.endsWith(".js")
    );

    if (!htmlFile) {
      return `
        <html>
          <body style="background: #1a1a2e; color: #666; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; margin: 0;">
            <div style="text-align: center;">
              <p style="font-size: 1.2rem;">No HTML file found</p>
              <p style="font-size: 0.9rem; color: #444;">Create an index.html to see the preview</p>
            </div>
          </body>
        </html>
      `;
    }

    let html = htmlFile.content;

    // Inject CSS if it exists and is referenced
    if (cssFile) {
      const linkTag = `<link rel="stylesheet" href="${cssFile.name}">`;
      const styleTag = `<style>${cssFile.content}</style>`;
      if (html.includes(linkTag) || html.includes(`href="${cssFile.name}"`)) {
        html = html.replace(
          /<link[^>]*href=["'][^"']*\.css["'][^>]*>/gi,
          styleTag
        );
      } else {
        html = html.replace("</head>", `${styleTag}\n</head>`);
      }
    }

    // Inject JS if it exists
    if (jsFile) {
      const scriptSrc = `<script src="${jsFile.name}"></script>`;
      const scriptInline = `<script>${jsFile.content}<\/script>`;
      if (html.includes(scriptSrc) || html.includes(`src="${jsFile.name}"`)) {
        html = html.replace(
          /<script[^>]*src=["'][^"']*\.js["'][^>]*><\/script>/gi,
          scriptInline
        );
      } else {
        html = html.replace("</body>", `${scriptInline}\n</body>`);
      }
    }

    // Inject console interceptor
    const consoleInterceptor = `
      <script>
        (function() {
          const originalConsole = {};
          ['log', 'error', 'warn', 'info'].forEach(method => {
            originalConsole[method] = console[method];
            console[method] = function(...args) {
              originalConsole[method].apply(console, args);
              window.parent.postMessage({
                type: 'console',
                method: method,
                content: args.map(a => {
                  try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }
                  catch(e) { return String(a); }
                }).join(' ')
              }, '*');
            };
          });
          window.onerror = function(msg, url, line, col, error) {
            window.parent.postMessage({
              type: 'console',
              method: 'error',
              content: msg + ' (line ' + line + ')'
            }, '*');
          };
        })();
      <\/script>
    `;
    html = html.replace("<head>", `<head>${consoleInterceptor}`);

    return html;
  }, [files]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "console") {
        setConsoleMessages((prev) => [
          ...prev.slice(-100), // Keep last 100 messages
          {
            type: event.data.method,
            content: event.data.content,
            timestamp: Date.now(),
          },
        ]);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const refresh = useCallback(() => {
    setConsoleMessages([]);
    setRefreshKey((k) => k + 1);
  }, []);

  // Auto-refresh on file changes
  useEffect(() => {
    if (autoRefresh) {
      refresh();
    }
  }, [files.map((f) => f.content).join(""), autoRefresh, refresh]);

  const previewContent = buildPreviewContent();

  const openInNewTab = () => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(previewContent);
      newWindow.document.close();
    }
  };

  return (
    <div className="h-full flex flex-col bg-[oklch(0.11_0.02_260)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Preview
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={cn(
              "px-2 py-0.5 text-[10px] rounded",
              autoRefresh
                ? "bg-primary/20 text-primary"
                : "bg-[oklch(0.18_0.02_260)] text-muted-foreground"
            )}
            onClick={onToggleAutoRefresh}
            title="Auto-refresh on save"
          >
            AUTO
          </button>
          <button
            type="button"
            className="p-1 hover:bg-[oklch(0.20_0.02_260)] rounded"
            onClick={refresh}
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            type="button"
            className="p-1 hover:bg-[oklch(0.20_0.02_260)] rounded"
            onClick={openInNewTab}
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            type="button"
            className="p-1 hover:bg-[oklch(0.20_0.02_260)] rounded relative"
            onClick={() => setShowConsole(!showConsole)}
            title="Toggle console"
          >
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            {consoleMessages.some((m) => m.type === "error") && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 relative">
        <iframe
          key={refreshKey}
          ref={iframeRef}
          srcDoc={previewContent}
          className="sandbox-frame absolute inset-0"
          sandbox="allow-scripts allow-modals"
          title="Live Preview"
        />
      </div>

      {/* Console */}
      {showConsole && (
        <div className="border-t border-border bg-[oklch(0.09_0.02_260)]">
          <div className="flex items-center justify-between px-3 py-1 border-b border-border">
            <div className="flex items-center gap-2">
              <Terminal className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Console
              </span>
              <span className="text-[10px] text-muted-foreground/60">
                ({consoleMessages.length})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-foreground px-1"
                onClick={() => setConsoleMessages([])}
              >
                Clear
              </button>
              <button
                type="button"
                className="p-0.5 hover:bg-[oklch(0.16_0.02_260)] rounded"
                onClick={() => setShowConsole(false)}
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="max-h-32 overflow-y-auto font-mono text-xs p-2 space-y-0.5">
            {consoleMessages.length === 0 && (
              <div className="text-muted-foreground/40 text-center py-2">
                No console output
              </div>
            )}
            {consoleMessages.map((msg, i) => (
              <div
                key={`${msg.timestamp}-${i}`}
                className={cn(
                  "px-1 py-0.5 rounded",
                  msg.type === "error" && "text-red-400 bg-red-500/5",
                  msg.type === "warn" && "text-yellow-400 bg-yellow-500/5",
                  msg.type === "info" && "text-blue-400",
                  msg.type === "log" && "text-foreground/80"
                )}
              >
                <span className="text-muted-foreground/40 mr-2">
                  {msg.type === "error"
                    ? "✕"
                    : msg.type === "warn"
                      ? "⚠"
                      : "›"}
                </span>
                {msg.content}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
