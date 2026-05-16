import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface SessionSidebarProps {
  projectId: Id<"projects">;
  activeSessionId: Id<"chatSessions"> | null;
  onSelectSession: (id: Id<"chatSessions">) => void;
  onNewSession: () => void;
}

export function SessionSidebar({
  projectId,
  activeSessionId,
  onSelectSession,
  onNewSession,
}: SessionSidebarProps) {
  const sessions = useQuery(api.chat.listSessions, { projectId }) ?? [];
  const renameSession = useMutation(api.chat.renameSession);
  const deleteSession = useMutation(api.chat.deleteSession);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const startRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const confirmRename = async (id: string) => {
    if (!editTitle.trim()) return;
    try {
      await renameSession({
        sessionId: id as Id<"chatSessions">,
        title: editTitle.trim(),
      });
      setEditingId(null);
    } catch {
      toast.error("Failed to rename");
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? Messages will be lost.`)) return;
    try {
      await deleteSession({ sessionId: id as Id<"chatSessions"> });
      toast.success("Deleted session");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Sessions
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={onNewSession}
          title="New chat"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No sessions yet
          </p>
        )}
        {sessions.map((s: NonNullable<typeof sessions>[number]) => {
          const isActive = s._id === activeSessionId;
          const title = s.title || "Untitled Chat";
          const isEditing = editingId === s._id;

          return (
            <div
              key={s._id}
              className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted/50 text-muted-foreground"
              }`}
              onClick={() => !isEditing && onSelectSession(s._id)}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              {isEditing ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <Input
                    className="h-6 text-xs px-1"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmRename(s._id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    className="p-0.5 hover:text-green-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmRename(s._id);
                    }}
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    className="p-0.5 hover:text-red-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="truncate flex-1 text-xs">{title}</span>
                  <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                    <button
                      className="p-0.5 hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(s._id, title);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      className="p-0.5 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(s._id, title);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
