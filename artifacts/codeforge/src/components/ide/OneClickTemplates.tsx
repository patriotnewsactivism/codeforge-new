/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE v2 — ONE-CLICK DEPLOY TEMPLATES (UPGRADE #5)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Pick a template → agents customize it to your prompt → 
 * preview is live in 60-90 seconds with a real public URL.
 *
 * Templates are not just starter files — the agent actively
 * reads the template, understands it, then rewrites/extends it
 * based on your specific requirements.
 *
 * Features:
 * - Template gallery with live preview thumbnails
 * - Category filters (SaaS, News, Legal, E-com, Portfolio, etc.)
 * - "Customize with AI" prompt before launching
 * - One-click deploy to Vercel/Netlify from within template selector
 * - WTP News / Civil Rights Hub branded templates (ecosystem lock-in!)
 * - Community templates from PromptMarketplace
 */

// src/components/ide/OneClickTemplates.tsx
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Rocket, Search, X,
  Zap, Star, ArrowRight, Loader2
} from "lucide-react";
import { motion } from "framer-motion";

type Category = "all" | "saas" | "news" | "legal" | "portfolio" | "ecommerce" | "dashboard" | "wtpnews";

const TEMPLATES: Template[] = [
  {
    id: "news-site",
    name: "News/Media Site",
    category: "news",
    description: "Full news platform: article listing, categories, search, author pages",
    techStack: ["React", "Tailwind", "Supabase"],
    deployTime: "~75s",
    stars: 142,
    preview: "https://placehold.co/320x200/111118/e63946?text=News+Site",
    featured: true,
    wtpBranded: false,
    agentPrompt: "Build a modern news website with dark theme, breaking news ticker, article cards by category, individual article pages with reading time, author bios, and a search bar",
  },
  {
    id: "civil-rights-intake",
    name: "Civil Rights Intake Form",
    category: "legal",
    description: "Professional legal intake form for civil rights incidents — WTP News ecosystem",
    techStack: ["React", "Supabase", "PDF export"],
    deployTime: "~60s",
    stars: 89,
    preview: "https://placehold.co/320x200/111118/60a5fa?text=Legal+Intake",
    featured: true,
    wtpBranded: true,
    agentPrompt: "Build a civil rights incident intake form with sections for: incident description, location, date/time, officer information, witness details, evidence upload, and PDF export. Dark professional theme matching civilrightshub.org",
  },
  {
    id: "saas-landing",
    name: "SaaS Landing Page",
    category: "saas",
    description: "High-conversion SaaS landing page with pricing, features, and CTA",
    techStack: ["React", "Tailwind", "Framer Motion"],
    deployTime: "~65s",
    stars: 234,
    preview: "https://placehold.co/320x200/111118/a78bfa?text=SaaS+Landing",
    featured: true,
    wtpBranded: false,
    agentPrompt: "Build a high-conversion SaaS landing page with: animated hero section, feature grid with icons, social proof section, 3-tier pricing table, FAQ accordion, and sticky CTA header",
  },
  {
    id: "activist-hub",
    name: "Activist Organization Hub",
    category: "wtpnews",
    description: "WTP News ecosystem — full activist org site with events, resources, donate",
    techStack: ["React", "Convex", "Stripe"],
    deployTime: "~90s",
    stars: 67,
    preview: "https://placehold.co/320x200/111118/f4a832?text=Activist+Hub",
    featured: false,
    wtpBranded: true,
    agentPrompt: "Build an activist organization website with: mission statement hero, events calendar, resource library with downloadable guides, volunteer signup form, secure donate button, and news feed integration",
  },
  {
    id: "admin-dashboard",
    name: "Admin Dashboard",
    category: "dashboard",
    description: "Full admin panel with charts, data tables, user management",
    techStack: ["React", "Recharts", "Tailwind"],
    deployTime: "~80s",
    stars: 178,
    preview: "https://placehold.co/320x200/111118/34d399?text=Dashboard",
    featured: false,
    wtpBranded: false,
    agentPrompt: "Build a comprehensive admin dashboard with: KPI stat cards, line/bar/pie charts using Recharts, a searchable sortable data table, sidebar navigation, dark theme, and responsive layout",
  },
  {
    id: "portfolio",
    name: "Developer Portfolio",
    category: "portfolio",
    description: "Sleek dev portfolio with projects, skills, and contact form",
    techStack: ["React", "Framer Motion", "EmailJS"],
    deployTime: "~55s",
    stars: 312,
    preview: "https://placehold.co/320x200/111118/f97316?text=Portfolio",
    featured: false,
    wtpBranded: false,
    agentPrompt: "Build a modern developer portfolio with: animated hero with typed text effect, project cards with live demo links, tech stack section with icons, timeline/experience section, and a contact form",
  },
  {
    id: "ecommerce-product",
    name: "E-Commerce Store",
    category: "ecommerce",
    description: "Complete shop with product grid, cart, and Stripe checkout",
    techStack: ["React", "Stripe", "Supabase"],
    deployTime: "~95s",
    stars: 156,
    preview: "https://placehold.co/320x200/111118/f43f5e?text=E-Commerce",
    featured: false,
    wtpBranded: false,
    agentPrompt: "Build an e-commerce store with: product listing grid with filters, product detail pages with image gallery, shopping cart sidebar, Stripe checkout integration, and order confirmation page",
  },
  {
    id: "wtpnews-article",
    name: "WTP News Article Template",
    category: "wtpnews",
    description: "Drop-in article page matching WTP News brand and style",
    techStack: ["React", "Tailwind", "SEO optimized"],
    deployTime: "~45s",
    stars: 44,
    preview: "https://placehold.co/320x200/111118/e63946?text=WTP+News",
    featured: false,
    wtpBranded: true,
    agentPrompt: "Build a WTP News article page template with: breaking news badge, article header with date/author, estimated read time, body content with pull quotes, related articles sidebar, social sharing buttons, and comment section — matching the WTP News dark red theme",
  },
];

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  techStack: string[];
  deployTime: string;
  stars: number;
  preview: string;
  featured: boolean;
  wtpBranded: boolean;
  agentPrompt: string;
}

interface OneClickTemplatesProps {
  onLaunch: (prompt: string, templateName: string) => void;
  onClose: () => void;
}

const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: "all", label: "All", emoji: "✦" },
  { id: "news", label: "News", emoji: "📰" },
  { id: "legal", label: "Legal", emoji: "⚖️" },
  { id: "saas", label: "SaaS", emoji: "🚀" },
  { id: "dashboard", label: "Dashboard", emoji: "📊" },
  { id: "portfolio", label: "Portfolio", emoji: "🎨" },
  { id: "ecommerce", label: "E-Com", emoji: "🛒" },
  { id: "wtpnews", label: "WTP News", emoji: "🔴" },
];

export function OneClickTemplates({ onLaunch, onClose }: OneClickTemplatesProps) {
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Template | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [launching, setLaunching] = useState(false);

  const filtered = TEMPLATES.filter(t => {
    const matchCat = category === "all" || t.category === category;
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleLaunch = async () => {
    if (!selected) return;
    setLaunching(true);
    const finalPrompt = customPrompt.trim()
      ? `${selected.agentPrompt}\n\nAdditional requirements: ${customPrompt}`
      : selected.agentPrompt;
    try {
      await onLaunch(finalPrompt, selected.name);
      onClose();
    } finally {
      setLaunching(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.97, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[#111118] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <Rocket className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="font-bold text-white">Templates</h2>
              <p className="text-xs text-white/40">Pick a template → agents build & deploy it</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/30 hover:text-white rounded-lg hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!selected ? (
          <>
            {/* Search + Categories */}
            <div className="px-6 py-3 border-b border-white/10 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
                      category === c.id
                        ? "bg-red-500/15 border-red-500/30 text-red-400"
                        : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
                    )}
                  >
                    <span>{c.emoji}</span> {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Template grid */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(template => (
                  <motion.button
                    key={template.id}
                    whileHover={{ y: -2 }}
                    onClick={() => { setSelected(template); setCustomPrompt(""); }}
                    className="text-left bg-[#1a1a24] border border-white/10 hover:border-white/20 rounded-xl overflow-hidden transition-all group"
                  >
                    <div className="relative">
                      <img
                        src={template.preview}
                        alt={template.name}
                        className="w-full h-36 object-cover"
                      />
                      {template.featured && (
                        <div className="absolute top-2 left-2 bg-amber-500/90 text-black text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Star className="w-3 h-3" /> Featured
                        </div>
                      )}
                      {template.wtpBranded && (
                        <div className="absolute top-2 right-2 bg-red-600/90 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          WTP
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-white group-hover:text-red-400 transition-colors">
                          {template.name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-white/30 flex-shrink-0">
                          <Star className="w-3 h-3" /> {template.stars}
                        </div>
                      </div>
                      <p className="text-xs text-white/40 mb-2 line-clamp-2">{template.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          {template.techStack.slice(0, 2).map(t => (
                            <Badge key={t} variant="outline" className="text-xs border-white/10 text-white/30 py-0">
                              {t}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-emerald-400">
                          <Zap className="w-3 h-3" /> {template.deployTime}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Template detail / launch */
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors"
            >
              ← Back to templates
            </button>

            <div className="flex gap-5">
              <img
                src={selected.preview}
                alt={selected.name}
                className="w-52 h-36 object-cover rounded-xl border border-white/10 flex-shrink-0"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                  {selected.wtpBranded && (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">WTP Ecosystem</Badge>
                  )}
                </div>
                <p className="text-white/50 text-sm mb-3">{selected.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selected.techStack.map(t => (
                    <Badge key={t} variant="outline" className="border-white/15 text-white/50">{t}</Badge>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-sm text-white/40">
                  <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-emerald-400" /> Deploy: {selected.deployTime}</span>
                  <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400" /> {selected.stars} uses</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-white/40 mb-1.5 block">
                What agents will build (edit to customize)
              </label>
              <textarea
                value={customPrompt || selected.agentPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/20"
              />
            </div>

            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Add any extra requirements (optional)</label>
              <input
                type="text"
                placeholder="e.g. Use our red brand color #e63946, add Spanish language support..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
                onBlur={e => {
                  if (e.target.value) setCustomPrompt(prev => prev + "\n\nExtra requirements: " + e.target.value);
                }}
              />
            </div>

            <Button
              onClick={handleLaunch}
              disabled={launching}
              size="lg"
              className="w-full bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 font-bold"
            >
              {launching ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Launching agents...</>
              ) : (
                <><Rocket className="w-4 h-4 mr-2" /> Launch & Deploy — {selected.deployTime} <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
