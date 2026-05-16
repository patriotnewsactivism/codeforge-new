import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Bot,
  GitBranch,
  DollarSign,
  Monitor,
  Eye,
  Users,
  ArrowRight,
  Code2,
  Sparkles,
  Menu,
  X,
} from "lucide-react";

const FEATURES = [
  {
    icon: Bot,
    title: "Multi-Model AI",
    description:
      "DeepSeek V4 Flash, Grok 4.1 Fast, GPT-5 Mini — switch models per-message. Automatic fallback if one fails.",
    color: "text-green-400",
    bgColor: "bg-green-400/10",
  },
  {
    icon: GitBranch,
    title: "GitHub Integration",
    description:
      "Import any repo, browse the full file tree, edit files, and commit changes back to GitHub.",
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
  },
  {
    icon: DollarSign,
    title: "Cost Tracking",
    description:
      "Real-time token usage and dollar amounts. Know exactly what each AI interaction costs, per session.",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
  },
  {
    icon: Monitor,
    title: "Full IDE Experience",
    description:
      "File tree explorer, tabbed code editor with syntax highlighting, keyboard shortcuts (Ctrl+S to save).",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
  },
  {
    icon: Eye,
    title: "Live Preview",
    description:
      "Built-in sandbox previews your HTML/CSS/JS in real-time. See what the AI builds instantly.",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
  },
  {
    icon: Users,
    title: "Live Collaboration",
    description:
      "Real-time presence, watch others code live, and cue the AI with @codeforge. Your team, one workspace.",
    color: "text-pink-400",
    bgColor: "bg-pink-400/10",
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [promptValue, setPromptValue] = useState("");

  const handlePromptSubmit = () => {
    navigate("/signup");
  };

  return (
    <div className="min-h-screen relative">
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md md:hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2 font-bold text-lg">
              <Code2 className="h-5 w-5 text-primary" />
              <span>CodeForge</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 -mr-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="px-5 py-8 space-y-6">
            <button
              type="button"
              className="block text-lg text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { navigate("/login"); setMobileMenuOpen(false); }}
            >
              Sign In
            </button>
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={() => { navigate("/signup"); setMobileMenuOpen(false); }}
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      )}

      {/* Header — compact on mobile */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 md:px-8 lg:px-12 h-14 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Code2 className="h-5 w-5 text-primary" />
            <span>CodeForge</span>
          </div>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <a href="/login">Sign In</a>
            </Button>
            <Button asChild size="sm">
              <a href="/signup">Get Started</a>
            </Button>
          </nav>
          {/* Mobile: single CTA + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <Button size="sm" onClick={() => navigate("/signup")}>
              Get Started
            </Button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -mr-2"
            >
              <Menu className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] md:w-[600px] md:h-[600px] bg-[oklch(0.75_0.18_190)] rounded-full opacity-[0.04] blur-[120px]" />
        </div>

        <div className="relative z-10 px-5 md:px-8 lg:px-12 max-w-7xl mx-auto">
          {/* Generous vertical spacing — matching Replit/Lovable/Base44 feel */}
          <div className="pt-16 md:pt-24 lg:pt-32 pb-8 md:pb-12 max-w-2xl mx-auto text-center">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[oklch(0.18_0.02_260)] border border-border text-xs text-muted-foreground mb-8 md:mb-6">
              <Sparkles className="h-3 w-3 text-primary" />
              <span>AI-Powered Coding Platform</span>
            </div>

            {/* Large heading — bigger line height on mobile */}
            <h1 className="text-[2.25rem] leading-[1.1] md:text-5xl lg:text-6xl font-bold tracking-tight mb-5 md:mb-6">
              Code smarter{" "}
              <br className="md:hidden" />
              with{" "}
              <span className="text-primary glow-cyan">CodeForge</span>
            </h1>

            {/* Subtitle — more breathing room */}
            <p className="text-base md:text-lg text-muted-foreground mb-10 md:mb-8 max-w-md mx-auto leading-relaxed">
              Write code with AI assistants, collaborate in real-time, and keep full control of costs.
            </p>

            {/* Prompt-style input — the main CTA, matching Replit/Lovable/Base44 pattern */}
            <div className="mx-auto max-w-md mb-4">
              <div className="relative bg-[oklch(0.16_0.02_260)] border border-border rounded-2xl p-4 shadow-lg shadow-black/20">
                <textarea
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none min-h-[52px]"
                  placeholder="Describe what you want to build..."
                  rows={2}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handlePromptSubmit();
                    }
                  }}
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">
                      Powered by multi-model AI
                    </span>
                  </div>
                  <button
                    type="button"
                    className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
                    onClick={handlePromptSubmit}
                  >
                    <ArrowRight className="h-4 w-4 text-primary-foreground" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick start suggestions — small pills */}
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {["Landing page", "Dashboard", "API wrapper", "Portfolio"].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="px-3 py-1.5 text-xs rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                    onClick={() => {
                      setPromptValue(`Build me a ${suggestion.toLowerCase()}`);
                    }}
                  >
                    {suggestion}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features — generous spacing, well below the fold on mobile */}
      <section className="py-16 md:py-20">
        <div className="px-5 md:px-8 lg:px-12 max-w-7xl mx-auto">
          <div className="text-center mb-10 md:mb-12">
            <p className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-3">
              Everything you need
            </p>
            <h2 className="text-2xl md:text-3xl font-bold">
              Built for real developers
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card p-5 md:p-6 hover:border-primary/30 transition-colors"
              >
                <div
                  className={`w-10 h-10 rounded-lg ${feature.bgColor} flex items-center justify-center mb-3`}
                >
                  <feature.icon className={`h-5 w-5 ${feature.color}`} />
                </div>
                <h3 className="text-sm md:text-base font-semibold mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="px-5 md:px-8 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Code2 className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">CodeForge</span>
            <span>— Built with ❤️</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
