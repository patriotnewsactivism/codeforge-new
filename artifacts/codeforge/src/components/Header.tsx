import { Link } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { Button } from "@/components/ui/button";
import { Code2 } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export function Header() {
  const { isAuthenticated } = useConvexAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <Code2 className="h-5 w-5 text-primary" />
          <span>{APP_NAME}</span>
        </Link>

        <nav className="flex items-center gap-3">
          {isAuthenticated ? (
            <Button asChild size="sm">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Sign In</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/signup">Get Started</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
