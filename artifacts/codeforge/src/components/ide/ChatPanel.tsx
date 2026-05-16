import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Send,
  Bot,
  User,
  AlertCircle,
  ChevronDown,
  Coins,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthToken } from "@/hooks/useAuthToken";
import type { Id } from "../../convex/_generated/dataModel";
import { UsageMeter } from "./UsageMeter";

const MODELS = [
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", shortName: "DS V4", icon: "⚡", color: "text-emerald-400" },
  { id: "deepseek-v3.2", name: "DeepSeek V3.2", shortName: "DS V3", icon: "🧠", color: "text-green-400" },
  { id: "grok-4.1-fast", name: "Grok 4.1 Fast", shortName: "Grok", icon: "⚡", color: "text-blue-400" },
  { id: "gpt-5-mini", name: "GPT-5 Mini", shortName: "GPT-5", icon: "🤖", color: "text-purple-400" },
];

interface FileContext {
  path: string;
  content: string;
}

interface ChatPanelProps {
  projectId: Id<"projects">;
  sessionId: Id<"chatSessions"> | null;
  currentFileContent?: string;
  currentFileName?: string;
  openFiles?: FileContext[];
}

function FileCodeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <path d="M10 12.5 8 15l2 2.5" />
      <path d="m14 12.5 2 2.5-2 2.5" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
    </svg>
  );
}

export function ChatPanel({
  projectId,
  sessionId,
  currentFileContent,
  currentFileName,
  openFiles,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = useQuery(api.chat.listMessages, sessionId ? { sessionId } : "skip");
  const session = useQuery(api.chat.getSession, sessionId ? { sessionId } : "skip");
  const sendMessage = useAction(api.chat.sendMessage);
  const updateModel = useMutation(api.chat.updateModel);
  const userId = useAuthToken();

  const currentModel = session?.model ?? "deepseek-v4-flash";
  const currentModelConfig = MODELS.find(m => m.id === currentModel) ?? MODELS[0]!;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-grow textarea, max 120px
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const handleSend = async () => {
    if (!input.trim() || !sessionId || isLoading || !userId) return;
    const msg = input.trim();
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    setIsLoading(true);
    try {
      const cleanMsg = msg.replace(/@codeforge\s*/gi, "").trim();
      const fileContexts = openFiles && openFiles.length > 0
        ? openFiles
        : currentFileContent && currentFileName
          ? [{ path: currentFileName, content: currentFileContent }]
          : undefined;
      await sendMessage({
        sessionId,
        projectId,
        content: cleanMsg,
        model: currentModel,
        fileContext: currentFileContent,
        fileContexts,
        userId: userId as Id<"users">,
      });
    } catch (error) {
      console.error("Failed to send:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col bg-[oklch(0.11_0.02_260)] min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            AI Chat
          </span>
        </div>

        {/* Model selector — shows short name on small screens */}
        <div className="relative shrink-0">
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[oklch(0.18_0.02_260)] hover:bg-[oklch(0.22_0.02_260)] transition-colors"
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
          >
            <span>{currentModelConfig!.icon}</span>
            <span className={cn(currentModelConfig!.color, "hidden sm:inline")}>
              {currentModelConfig!.name}
            </span>
            <span className={cn(currentModelConfig!.color, "sm:hidden text-[10px]")}>
              {currentModelConfig!.shortName}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
          {modelDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-[oklch(0.16_0.02_260)] border border-border rounded-md shadow-xl py-1 min-w-[160px]">
              {MODELS.map(model => (
                <button
                  key={model.id}
                  type="button"
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-[oklch(0.22_0.02_260)] transition-colors",
                    currentModel === model.id && "bg-[oklch(0.20_0.02_260)]"
                  )}
                  onClick={() => {
                    if (sessionId) updateModel({ sessionId, model: model.id });
                    setModelDropdownOpen(false);
                  }}
                >
                  <span>{model.icon}</span>
                  <span className={model.color}>{model.name}</span>
                  {currentModel === model.id && <Zap className="h-3 w-3 text-primary ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cost tracker */}
      {session && session.totalCost > 0 && (
        <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-[oklch(0.12_0.02_260)] text-xs text-muted-foreground shrink-0">
          <Coins className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {session.totalTokensUsed.toLocaleString()} tokens · ${session.totalCost.toFixed(4)}
          </span>
        </div>
      )}

      {/* Usage meter — shows remaining requests/missions with upgrade CTA */}
      <div className="relative flex items-center justify-end px-3 py-1.5 border-b border-border/40 shrink-0 bg-[oklch(0.095_0.02_260)]">
        <UsageMeter />
      </div>

      {/* Messages — scrollable, no overflow-x */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-3 min-w-0">
        {(!messages || messages.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Bot className="h-10 w-10 text-primary/30 mb-3" />
            <p className="text-sm text-muted-foreground">Ask me anything about your code</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Type <span className="text-primary">@codeforge</span> to include file context
            </p>
          </div>
        )}

        {messages?.map((msg: NonNullable<typeof messages>[number]) => (
          <div
            key={msg._id}
            className={cn("flex gap-2 min-w-0", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                {msg.isError
                  ? <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  : <Bot className="h-3.5 w-3.5 text-primary" />}
              </div>
            )}
            <div className={cn(
              "rounded-lg px-3 py-2 text-sm min-w-0",
              // CRITICAL: max-w-[85%] + overflow-wrap prevents messages blowing out mobile width
              "max-w-[85%] overflow-hidden",
              msg.role === "user"
                ? "bg-primary/20 text-foreground"
                : msg.isError
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : "bg-[oklch(0.16_0.02_260)] text-foreground"
            )}>
              {/* CRITICAL: break-words + overflow-wrap break long code/URLs */}
              <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere text-[13px] leading-relaxed">
                {msg.content}
              </div>
              {msg.model && (
                <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground flex-wrap">
                  <span>{msg.model}</span>
                  {msg.tokensUsed && <><span>·</span><span>{msg.tokensUsed} tok</span></>}
                  {msg.cost !== undefined && msg.cost > 0 && <><span>·</span><span>${msg.cost.toFixed(4)}</span></>}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-6 h-6 rounded-full bg-[oklch(0.25_0.02_260)] flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5 text-primary animate-pulse" />
            </div>
            <div className="bg-[oklch(0.16_0.02_260)] rounded-lg px-3 py-2">
              <div className="flex gap-1">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${delay}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* File context indicator */}
      {currentFileName && (
        <div className="px-3 py-1 text-[10px] text-muted-foreground border-t border-border flex items-center gap-1 shrink-0 min-w-0">
          <FileCodeIcon className="h-3 w-3 shrink-0" />
          <span className="truncate">Context: {currentFileName}</span>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2 border-t border-border shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            className="flex-1 min-w-0 bg-[oklch(0.18_0.02_260)] border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none overflow-hidden"
            style={{ minHeight: "38px" }}
            placeholder="Ask anything... (Enter to send)"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
          />
          <button
            type="button"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-primary hover:bg-primary/80 disabled:opacity-40 transition-colors"
            disabled={!input.trim() || isLoading}
            onClick={handleSend}
            aria-label="Send"
          >
            <Send className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
