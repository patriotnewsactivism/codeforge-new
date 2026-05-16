# CodeForge V2 — Project Chapters

> AI-powered coding platform with multi-model chat, live preview, multi-agent mode, and real-time collaboration.
> **Repo:** `patriotnewsactivism/codeforge-v2`
> **Stack:** React + TypeScript + Vite + Convex + Tailwind CSS + Monaco Editor + shadcn/ui

---

## Chapter 1: Foundation & App Shell

**Goal:** Application bootstrapping, routing, theming, and layout.

| File | Purpose |
|------|---------|
| `src/main.tsx` | App entry point, Convex provider setup |
| `src/App.tsx` | Root component, route definitions |
| `src/components/AppLayout.tsx` | Authenticated layout wrapper with sidebar |
| `src/components/AppSidebar.tsx` | Navigation sidebar |
| `src/components/Header.tsx` | Top header bar |
| `src/components/PublicLayout.tsx` | Layout for unauthenticated pages |
| `src/contexts/ThemeContext.tsx` | Dark/light theme management |
| `src/lib/utils.ts` | Shared utility functions (cn, className merging) |
| `src/lib/constants.ts` | App-wide constants |
| `src/pages/index.ts` | Barrel export for all pages |
| `src/vite-env.d.ts` | Vite type declarations |

**Configuration Files:**

| File | Purpose |
|------|---------|
| `index.html` | HTML shell, Vite entry |
| `vite.config.ts` | Vite build configuration |
| `biome.json` | Linter/formatter config (Biome) |
| `components.json` | shadcn/ui component configuration |
| `tsconfig.json` | Root TypeScript config |
| `tsconfig.app.json` | App-specific TS config |
| `tsconfig.node.json` | Node/build TS config |
| `vercel.json` | Vercel deployment config |
| `package.json` | Dependencies and scripts |
| `package-lock.json` | Dependency lock file |
| `bun.lock` | Bun package manager lock file |
| `.env.example` | Environment variable template |
| `.gitignore` | Git ignore rules |
| `README.md` | Project documentation |
| `todo.md` | Development TODO list |

**Key Concepts:**
- Convex client initialized in `main.tsx` with real-time subscriptions
- Protected vs. public route separation via `ProtectedRoute.tsx` / `PublicOnlyRoute.tsx`
- shadcn/ui component library in `src/components/ui/`
- Biome for linting/formatting (replaces ESLint+Prettier)

---

## Chapter 2: Authentication & Users

**Goal:** User sign-up, login, and session management.

| File | Purpose |
|------|---------|
| `src/components/SignIn.tsx` | Login form component |
| `src/components/SignUp.tsx` | Registration form component |
| `src/components/ProtectedRoute.tsx` | Auth guard — redirects unauthenticated users |
| `src/components/PublicOnlyRoute.tsx` | Redirect if already authenticated |
| `src/components/TestUserLoginSection.tsx` | Demo/test user quick login |
| `src/pages/LoginPage.tsx` | Login page |
| `src/pages/SignupPage.tsx` | Signup page |
| `src/hooks/useAuthToken.ts` | Auth token management hook |
| `convex/auth.ts` | Server-side auth logic |
| `convex/auth.config.ts` | Auth provider configuration |
| `convex/users.ts` | User CRUD operations |
| `convex/seedTestUser.ts` | Test user seeding script |
| `convex/testAuth.ts` | Auth testing utilities |

**Key Concepts:**
- Convex Auth handles authentication
- Token-based sessions with `useAuthToken` hook
- Test user seeding for development

---

## Chapter 3: Project Management & Dashboard

**Goal:** Create, list, open, and manage coding projects.

| File | Purpose |
|------|---------|
| `src/pages/DashboardPage.tsx` | Project list, creation, and quick-access UI |
| `src/pages/IDEPage.tsx` | IDE workspace (loads a project into the editor) |
| `convex/projects.ts` | Project CRUD — create, list, rename, delete, update |
| `convex/schema.ts` | `projects` table: name, description, ownerId, githubRepo, language, lastOpenedAt |

**Key Concepts:**
- Each project has an `ownerId`, optional `githubRepo` link, and `lastOpenedAt` timestamp
- Projects indexed by owner for fast dashboard queries
- Dashboard serves as the hub — click a project to enter the IDE

---

## Chapter 4: File System & Code Editor

**Goal:** In-browser file tree, Monaco editor, and file management.

| File | Purpose |
|------|---------|
| `src/components/ide/FileTree.tsx` | File/folder tree with create, rename, delete |
| `src/components/ide/CodeEditor.tsx` | Monaco editor — syntax highlighting, auto-complete, Ctrl+S |
| `src/components/ide/EditorTabs.tsx` | Multi-tab file editing with close/switch |
| `convex/files.ts` | File CRUD — create, read, update, delete files and directories |
| `convex/schema.ts` | `files` table: projectId, path, name, content, isDirectory, parentPath |

**Key Concepts:**
- Files stored in Convex with `path` and `parentPath` for tree structure
- Monaco editor provides VS Code-quality editing in-browser
- Real-time file sync — changes persist immediately via Convex mutations

---

## Chapter 5: AI Chat & Multi-Model Support

**Goal:** Chat with AI about your code, switch models per message, automatic fallback.

| File | Purpose |
|------|---------|
| `src/components/ide/ChatPanel.tsx` | Chat UI — message list, input, model selector |
| `src/components/ide/SessionSidebar.tsx` | Chat session list — create, rename, archive sessions |
| `convex/chat.ts` | AI chat logic, model routing, fallback chain, token tracking |
| `convex/constants.ts` | Model definitions, API endpoints, model configs |
| `convex/schema.ts` | `chatSessions` & `chatMessages` tables |

**Key Concepts:**
- Supported models: DeepSeek V3.2, Grok 4.1 Fast, GPT-5 Mini
- Per-message model switching — user can pick a different model for each message
- Automatic fallback: if one model fails, the system tries the next in chain
- File contexts attached to messages for code-aware responses
- Token usage and cost tracked per message and session

---

## Chapter 6: Smart Suggestions & Change History

**Goal:** AI proactively suggests features/improvements; one-tap implement with undo.

| File | Purpose |
|------|---------|
| `src/components/ide/SuggestionsPanel.tsx` | Suggestion cards — approve, implement, dismiss |
| `convex/suggestions.ts` | Generate, list, implement, dismiss suggestions |
| `convex/changeHistory.ts` | Track file changes with before/after content for rollback |
| `convex/schema.ts` | `suggestions` & `changeHistory` tables |

**Key Concepts:**
- AI analyzes the project and generates prioritized suggestions (high/medium/low)
- Each suggestion includes an `implementationPrompt` for one-click execution
- Change history records every file modification with before/after content
- Full undo support — roll back any suggestion or build step

---

## Chapter 7: Live Preview & Build Loop

**Goal:** Sandbox preview of the app, AI builds autonomously, auto-fixes errors.

| File | Purpose |
|------|---------|
| `src/components/ide/LivePreview.tsx` | Sandboxed iframe preview with console output |
| `src/components/ide/BuildProgress.tsx` | Build session progress indicator |
| `convex/buildLoop.ts` | Autonomous build — AI writes code, sees errors, iterates |
| `convex/schema.ts` | `buildSessions` & `buildSteps` tables |

**Key Concepts:**
- Live sandbox auto-refreshes on file changes
- Build loop: AI agent writes code → sandbox runs it → captures errors → AI fixes → repeat
- Build sessions track overall progress; build steps log individual actions
- Console output piped back to the AI for error awareness

---

## Chapter 8: Multi-Agent System

**Goal:** Parallel AI agents (UI, Logic, Debug, Feature) tackling different parts simultaneously.

| File | Purpose |
|------|---------|
| `src/components/ide/AgentPanel.tsx` | Agent task list and status overview |
| `src/components/ide/AgentActivityPanel.tsx` | Live agent activity feed |
| `src/components/ide/AgentThoughtStream.tsx` | Real-time agent thinking stream |
| `convex/agents.ts` | Agent orchestration — spawn, coordinate, complete tasks |
| `convex/agentThoughts.ts` | Streaming thought process for each agent |
| `convex/engine.ts` | V2 engine — tool-based agent execution framework |
| `convex/schema.ts` | `agentTasks`, `agentMessages`, `agentThoughts`, `toolCalls` tables |

**Key Concepts:**
- Specialized agent roles: UI Agent, Logic Agent, Debug Agent, Feature Agent
- Agent-to-agent communication via message bus (warnings, context, requests, findings)
- Real-time thought streaming — see what each agent is thinking live
- Tool calls tracked per mission: `create_file`, `edit_file`, `read_file`, etc.

---

## Chapter 9: Agent Memory & Self-Improvement

**Goal:** Persistent memory that makes agents smarter over time.

| File | Purpose |
|------|---------|
| `src/components/ide/MemoryTab.tsx` | Memory viewer — browse learned patterns and insights |
| `convex/memory.ts` | Memory CRUD — create, query, decay, prune |
| `convex/schema.ts` | `agentMemories` & `taskRetrospectives` tables |

**Key Concepts:**
- Memory categories: pattern, anti_pattern, preference, architecture, dependency, bugfix, convention, tool, insight
- Importance scoring (0.0–1.0) with usage-based decay
- Retrospective agent runs after every task — scores quality, extracts learnings
- Memories injected into future agent prompts for continuous improvement

---

## Chapter 10: Codebase RAG & Search

**Goal:** Semantic search across the entire project codebase.

| File | Purpose |
|------|---------|
| `convex/rag.ts` | TF-IDF indexing, search queries, tag extraction |
| `convex/schema.ts` | `codebaseIndex` table: fileId, termFrequency, tags, tokenCount |

**Key Concepts:**
- Every file indexed with TF-IDF term frequency and extracted tags (function names, imports, classes)
- Agents can search the codebase semantically before making changes
- Index updated on file changes for real-time accuracy

---

## Chapter 11: Git Integration

**Goal:** Commit, push, and manage branches tied to GitHub.

| File | Purpose |
|------|---------|
| `src/components/ide/GitPanel.tsx` | Git UI — branches, commits, push status |
| `convex/git.ts` | Git operations — commit, branch, push to GitHub |
| `convex/schema.ts` | `gitCommits` & `gitBranches` tables |

**Key Concepts:**
- Projects can be linked to a GitHub repo
- Agents auto-commit changes with descriptive messages
- Branch management with PR tracking (open/merged/closed)
- Full commit history with files changed per commit

---

## Chapter 12: Real-Time Collaboration

**Goal:** Live presence, shared editing, and invite links.

| File | Purpose |
|------|---------|
| `src/components/ide/CollaborationBar.tsx` | Active collaborator avatars and presence |
| `convex/collaboration.ts` | Presence tracking, invite generation, session management |
| `convex/schema.ts` | `collaborators` & `projectInvites` tables |

**Key Concepts:**
- Real-time presence — see who's editing which file, cursor position, color-coded
- Shareable invite codes with expiration for live collaboration sessions
- Convex's real-time subscriptions power instant presence updates

---

## Chapter 13: Monetization & Stripe

**Goal:** Subscription plans, checkout, and billing management.

| File | Purpose |
|------|---------|
| `src/pages/PricingPage.tsx` | Plan comparison and selection |
| `src/pages/CheckoutSuccess.tsx` | Post-checkout confirmation |
| `src/pages/SettingsPage.tsx` | Account, subscription, and preference management |
| `convex/stripe.ts` | Stripe integration — checkout sessions, webhook handling, subscription management |
| `convex/http.ts` | HTTP route handler — Stripe webhooks, API endpoints |
| `convex/schema.ts` | `subscriptions` table: planKey, stripeCustomerId, status, dates |

**Key Concepts:**
- Plans: Free, Weekly, Monthly, Lifetime
- Stripe Checkout for payment flow
- Webhook handling for subscription lifecycle events (created, updated, cancelled)
- Plan enforcement at the API level

---

## Chapter 14: Landing & Marketing Pages

**Goal:** Public-facing pages for conversion and marketing.

| File | Purpose |
|------|---------|
| `src/pages/LandingPage.tsx` | Main landing/marketing page with hero, features, CTAs |
| `src/pages/PricingPage.tsx` | Pricing tiers display and selection |
| `src/components/PublicLayout.tsx` | Shared layout for public pages |

---

## Chapter 15: Export & External Integrations

**Goal:** Project export and external service integrations.

| File | Purpose |
|------|---------|
| `convex/export.ts` | Download full project as JSON bundle |
| `convex/viktorTools.ts` | Viktor AI integration tools |
| `convex/ViktorSpacesEmail.ts` | Email notification via Viktor Spaces |

---

## Chapter 16: Shared Hooks & Error Handling

**Goal:** Reusable hooks, error boundaries, and utilities.

| File | Purpose |
|------|---------|
| `src/hooks/use-mobile.tsx` | Mobile viewport detection hook |
| `src/hooks/useComposition.ts` | Input composition handling (IME support) |
| `src/hooks/usePersistFn.ts` | Persistent function reference hook |
| `src/components/ErrorBoundary.tsx` | Global error boundary — catches and displays errors |
| `src/components/ide/PanelErrorBoundary.tsx` | Per-panel error isolation — prevents one panel crash from killing others |
| `src/components/ide/PanelSkeleton.tsx` | Loading skeleton for IDE panels |

---

## Chapter 17: UI Component Library (shadcn/ui)

**Goal:** Reusable, accessible UI primitives used across the entire app.

All components live in `src/components/ui/` and are generated via shadcn/ui:

| Component | File |
|-----------|------|
| Accordion | `accordion.tsx` |
| Alert | `alert.tsx` |
| Alert Dialog | `alert-dialog.tsx` |
| Aspect Ratio | `aspect-ratio.tsx` |
| Avatar | `avatar.tsx` |
| Badge | `badge.tsx` |
| Breadcrumb | `breadcrumb.tsx` |
| Button | `button.tsx` |
| Button Group | `button-group.tsx` |
| Calendar | `calendar.tsx` |
| Card | `card.tsx` |
| Carousel | `carousel.tsx` |
| Chart | `chart.tsx` |
| Checkbox | `checkbox.tsx` |
| Collapsible | `collapsible.tsx` |
| Command | `command.tsx` |
| Context Menu | `context-menu.tsx` |
| Dialog | `dialog.tsx` |
| Drawer | `drawer.tsx` |
| Dropdown Menu | `dropdown-menu.tsx` |
| Empty State | `empty.tsx` |
| Field | `field.tsx` |
| Form | `form.tsx` |
| Hover Card | `hover-card.tsx` |
| Input | `input.tsx` |
| Input Group | `input-group.tsx` |
| Input OTP | `input-otp.tsx` |
| Item | `item.tsx` |
| Kbd | `kbd.tsx` |
| Label | `label.tsx` |
| Menubar | `menubar.tsx` |
| Navigation Menu | `navigation-menu.tsx` |
| Pagination | `pagination.tsx` |
| Popover | `popover.tsx` |
| Progress | `progress.tsx` |
| Radio Group | `radio-group.tsx` |
| Resizable | `resizable.tsx` |
| Scroll Area | `scroll-area.tsx` |
| Select | `select.tsx` |
| Separator | `separator.tsx` |
| Sheet | `sheet.tsx` |
| Sidebar | `sidebar.tsx` |
| Skeleton | `skeleton.tsx` |
| Slider | `slider.tsx` |
| Sonner (Toast) | `sonner.tsx` |
| Spinner | `spinner.tsx` |
| Switch | `switch.tsx` |
| Table | `table.tsx` |
| Tabs | `tabs.tsx` |
| Textarea | `textarea.tsx` |
| Toggle | `toggle.tsx` |
| Toggle Group | `toggle-group.tsx` |
| Tooltip | `tooltip.tsx` |

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Vite + React)           │
│  ┌─────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │Dashboard │  │ IDE Page │  │  Public Pages      │  │
│  │  Ch. 3   │  │ Ch. 4-12│  │  Ch. 2, 13, 14     │  │
│  └─────────┘  └──────────┘  └────────────────────┘  │
│       │              │                │              │
│  ┌────┴──────────────┴────────────────┴───────────┐  │
│  │            Convex Real-Time Client              │  │
│  └─────────────────────┬───────────────────────────┘  │
└────────────────────────┼─────────────────────────────┘
                         │
┌────────────────────────┼─────────────────────────────┐
│               Convex Backend (Serverless)             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ projects │  │  chat    │  │  agents/engine    │    │
│  │  files   │  │ sessions │  │  memory/retros    │    │
│  │  Ch. 3-4 │  │  Ch. 5   │  │  Ch. 8-9         │    │
│  └──────────┘  └──────────┘  └──────────────────┘    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │  git     │  │ collab   │  │  stripe/billing   │    │
│  │  Ch. 11  │  │  Ch. 12  │  │  Ch. 13           │    │
│  └──────────┘  └──────────┘  └──────────────────┘    │
└───────────────────────────────────────────────────────┘
```

---

## File Counts by Chapter

| Chapter | Files |
|---------|-------|
| Ch. 1: Foundation | 11 source + 15 config |
| Ch. 2: Auth | 13 |
| Ch. 3: Projects | 4 |
| Ch. 4: File System | 5 |
| Ch. 5: AI Chat | 5 |
| Ch. 6: Suggestions | 4 |
| Ch. 7: Live Preview | 4 |
| Ch. 8: Multi-Agent | 7 |
| Ch. 9: Memory | 3 |
| Ch. 10: RAG | 2 |
| Ch. 11: Git | 3 |
| Ch. 12: Collaboration | 3 |
| Ch. 13: Stripe | 6 |
| Ch. 14: Landing | 3 |
| Ch. 15: Export | 3 |
| Ch. 16: Hooks/Errors | 6 |
| Ch. 17: UI Library | 42 |
| **Total** | **~124 source + 15 config** |
