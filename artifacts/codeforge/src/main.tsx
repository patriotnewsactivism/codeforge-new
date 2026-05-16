import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;

function Root() {
  if (!convexUrl) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <h1 className="text-2xl font-bold text-primary mb-4">CodeForge</h1>
          <p className="text-muted-foreground mb-4">
            To connect your Convex backend, set the <code className="text-primary bg-muted px-1 rounded">VITE_CONVEX_URL</code> environment variable.
          </p>
          <p className="text-sm text-muted-foreground">
            Get your URL from the <a href="https://dashboard.convex.dev" className="text-primary underline" target="_blank" rel="noreferrer">Convex dashboard</a> or by running <code className="text-primary bg-muted px-1 rounded">npx convex dev</code>.
          </p>
        </div>
      </div>
    );
  }

  const convex = new ConvexReactClient(convexUrl);

  return (
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConvexAuthProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
