import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Users, Copy, Check, Link2, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Id } from "../../convex/_generated/dataModel";

interface CollaborationBarProps {
  projectId: Id<"projects">;
  projectName: string;
}

export function CollaborationBar({ projectId, projectName }: CollaborationBarProps) {
  const collaborators = useQuery(api.collaboration.listActive, { projectId });
  const createInvite = useMutation(api.collaboration.createInvite);
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateInvite = async () => {
    const code = await createInvite({ projectId });
    setInviteCode(code);
  };

  const handleCopyInvite = () => {
    if (inviteCode) {
      const url = `${window.location.origin}/join/${inviteCode}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-[oklch(0.09_0.02_260)] border-b border-border min-w-0">
      {/* Back button (mobile) */}
      <button
        type="button"
        onClick={() => navigate("/dashboard")}
        className="p-1 rounded text-muted-foreground hover:text-foreground sm:hidden shrink-0"
        aria-label="Back to dashboard"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Project name — truncates on small screens */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className="text-primary font-bold text-sm shrink-0">{"</>"}</span>
        <span className="text-xs sm:text-sm font-medium text-foreground truncate">
          {projectName}
        </span>
      </div>

      {/* Active collaborators — hidden on very small screens */}
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="flex items-center -space-x-1.5">
          {collaborators?.map((collab: NonNullable<typeof collaborators>[number]) => (
            <div
              key={collab._id}
              className="w-6 h-6 rounded-full border-2 border-[oklch(0.09_0.02_260)] flex items-center justify-center text-[10px] font-bold"
              style={{ backgroundColor: collab.color }}
              title={collab.userName}
            >
              {collab.userName.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* Invite button */}
      <div className="flex items-center gap-1.5 shrink-0">
        {!inviteCode ? (
          <button
            type="button"
            onClick={handleCreateInvite}
            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Link2 className="h-3 w-3" />
            <span className="hidden sm:inline">Invite</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCopyInvite}
            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-primary/20 text-primary transition-colors"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span className="hidden sm:inline">{copied ? "Copied!" : "Copy link"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
