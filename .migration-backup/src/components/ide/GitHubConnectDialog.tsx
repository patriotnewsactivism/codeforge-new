import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Github, Loader2, CheckCircle, ExternalLink } from "lucide-react";

export function GitHubConnectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [token, setToken] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<{
    valid: boolean;
    username?: string;
  } | null>(null);
  const validateToken = useAction(api.github.validateToken);

  const handleValidate = async () => {
    if (!token.trim()) return;
    setIsValidating(true);
    try {
      const res = await validateToken({ token: token.trim() });
      setResult(res);
      if (res.valid) {
        toast.success(`Connected as ${res.username}`);
        onOpenChange(false);
      } else {
        toast.error(res.error || "Invalid token");
      }
    } catch (e) {
      toast.error("Failed to validate token");
    }
    setIsValidating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Connect GitHub
          </DialogTitle>
          <DialogDescription>
            Enter a Personal Access Token to import and sync your repositories.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-card/50 border border-border p-3 text-xs">
            <p className="font-medium mb-2">How to create a token:</p>
            <ol className="space-y-1 text-muted-foreground list-decimal list-inside">
              <li>
                Go to{" "}
                <a
                  href="https://github.com/settings/tokens/new"
                  target="_blank"
                  rel="noopener"
                  className="text-chart-3 hover:underline inline-flex items-center gap-0.5"
                >
                  GitHub Token Settings
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </li>
              <li>
                Select scopes: <Badge variant="secondary" className="text-[9px] h-3.5">repo</Badge>{" "}
                (Full control of private repositories)
              </li>
              <li>Generate and paste the token below</li>
            </ol>
          </div>

          <Input
            type="password"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setResult(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleValidate()}
          />

          {result?.valid && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle className="h-4 w-4" />
              Connected as <strong>{result.username}</strong>
            </div>
          )}

          <Button
            onClick={handleValidate}
            disabled={isValidating || !token.trim()}
            className="w-full"
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Github className="h-4 w-4 mr-2" />
            )}
            {isValidating ? "Validating..." : "Connect"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
