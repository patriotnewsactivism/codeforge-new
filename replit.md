# CodeForge

AI-powered coding platform with multi-model chat, live preview, multi-agent mode, and real-time collaboration.

## Run & Operate

- `pnpm --filter @workspace/codeforge run dev` — run the frontend (port assigned by workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `VITE_CONVEX_URL` — Convex deployment URL (from dashboard.convex.dev or `npx convex dev`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4 + shadcn/ui
- Backend: Convex (real-time backend-as-a-service)
- Auth: Convex Auth (`@convex-dev/auth`)
- Code editor: Monaco Editor
- Routing: React Router DOM
- API: Express 5 (for REST endpoints if needed)
- DB: PostgreSQL + Drizzle ORM (for REST API routes)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle for api-server)

## Where things live

- `artifacts/codeforge/` — React + Vite frontend
- `artifacts/codeforge/src/` — App source
- `artifacts/codeforge/src/pages/` — Page components (LandingPage, DashboardPage, IDEPage, etc.)
- `artifacts/codeforge/src/components/` — Shared components
- `artifacts/codeforge/src/components/ide/` — IDE-specific components (editor panels, chat, etc.)
- `artifacts/codeforge/convex/` — Convex backend functions and schema
- `artifacts/codeforge/convex/_generated/` — Convex generated API types (run `npx convex dev` to regenerate)
- `artifacts/api-server/` — Express REST API server
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for REST API contracts)

## Architecture decisions

- Uses Convex as the real-time backend (WebSocket-based, serverless functions) rather than a traditional REST API
- Convex Auth for authentication (not Clerk or Replit Auth)
- Monaco Editor for in-app code editing
- Always-dark theme (no light mode toggle) — hardcoded to dark
- React Router DOM (v7) for client-side routing (not wouter)

## Product

- AI-powered coding platform with multi-model chat
- Live preview of projects being built
- Multi-agent mode with agent thought streaming
- Real-time collaboration
- GitHub integration for importing/exporting repos
- Pricing tiers with Stripe checkout
- Monaco-based code editor with file tree, diff viewer, etc.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `VITE_CONVEX_URL` must be set for the app to connect to the Convex backend. Get it from [dashboard.convex.dev](https://dashboard.convex.dev) or by running `npx convex dev`.
- Convex generated files are in `artifacts/codeforge/convex/_generated/` — regenerate with `npx convex dev` when changing schema/functions.
- The app uses React Router DOM v7 (not wouter despite wouter being in the scaffold).
- Always dark mode — `ThemeProvider` is set to `defaultTheme="dark" switchable={false}`.
- `artifacts/codeforge/vite.config.ts` has path aliases for the Convex generated files to handle relative imports from different directory depths.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Convex docs: https://docs.convex.dev
