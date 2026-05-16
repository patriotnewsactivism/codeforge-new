---
name: data-visualization
description: Build interactive data visualization apps (dashboards, analysis reports, dataset explorers) with React, Recharts, and OpenAPI codegen workflow. Handles all data sources internally including integrations, databases, APIs, and CSV files.
---

# Data Visualization Skill

This skill helps you create interactive data visualization apps with charts, data tables, and CSV handling.

## When to Use

Use this skill when the user asks to:

- **Create a dashboard, report, or data exploration app** with data from any source
- **Build charts, graphs, or data tables**
- **Visualize data** from integrations (Stripe, Google Analytics, Linear, databases, etc.)
- **Create an interactive analytics dashboard** with filters and controls
- **Build a reporting interface**, metrics dashboard, or analysis report
- **Explore or investigate a dataset** with filters and drill-down
- **Combine multiple data sources** into a unified visualization

**Key point:** This skill handles data fetching internally. You do NOT need to query data first using other skills - this skill will use `searchIntegrations()` and `proposeIntegration()` to connect to data sources as part of building the app.

### Example user requests

- "Create a dashboard showing my Stripe revenue"
- "Build a sales analytics dashboard"
- "Analyze my revenue data and present the findings"
- "Create a report explaining why conversions dropped"
- "Let me explore my customer data with filters"
- "Build a tool to browse and filter our product catalog"
- "Visualize this CSV file"

## When NOT to Use

- The user is asking questions about data in chat (e.g., "How many Linear issues were closed last week?") - use `query-integration-data` skill
- The user simply wants to fetch/export/transform data without visualization - use `query-integration-data` skill
- The user is not asking for any visual output or web interface

## Architecture

This skill uses the **react-vite scaffold** with backend conventions from the **`pnpm-workspace` skill**:

1. Create the artifact (`createArtifact()` with type `data-visualization`)
2. Install data-viz packages and patch CSS (chart colors + print styles)
3. Follow the contract-first backend flow from the `pnpm-workspace` skill (`references/openapi.md`, `references/server.md`, `references/db.md`)
4. Launch a design subagent (async) for the frontend
5. Implement API routes in the shared `artifacts/api-server/`

See `.local/skills/data-visualization/references/common-bootstrap.md` for the full step-by-step workflow.

**IMPORTANT:** Data visualization artifacts must use the design subagent workflow. The reference files contain critical layout and styling specifications that only the design subagent can consume. Plan dashboard summary, grouped counts, and trend endpoints in the OpenAPI spec so the design subagent has real hooks for the wow surfaces.

## Cost Control: Refresh Floor is 5 Minutes (HARD FLOOR — NOT NEGOTIABLE)

Data visualization apps frequently query paid data warehouses (BigQuery, Snowflake,
Databricks) or rate-limited third-party APIs. **5 minutes is a hard floor.** Never
configure auto-refresh, `refetchInterval`, `setInterval`, or any other polling
mechanism to re-fetch data more often than once every 5 minutes — a dashboard polling
every 2–3 seconds can run up five- or six-figure daily bills against BigQuery.

This floor is **not negotiable**. If the user asks for a 30-second, 1-minute, or any
sub-5-minute refresh:

1. Explain the cost impact (warehouse queries are billed per byte scanned; sub-5-min
   refresh can cost hundreds to thousands of dollars per day per user).
2. Offer the **manual Refresh button** for on-demand updates as often as the user wants.
3. Offer **5 minutes** as the lowest auto-refresh interval.
4. **Do NOT** generate code that polls more frequently, even if the user insists they
   accept the cost. The cost would be borne by the platform, not the user — this is a
   platform-level guardrail, not a user preference.

Required defaults for every data visualization artifact:

- **Auto-refresh off by default.** Users opt in via the refresh dropdown; see `references/dashboard-controls.md`.
- **Minimum allowed interval: 5 minutes.** Do not add shorter options to `INTERVAL_OPTIONS`.
- **`staleTime: 5 * 60 * 1000`** on the React Query client so remounts don't re-run warehouse queries.
- **`refetchOnWindowFocus: false`** on the React Query client.
- **DB-backed caching** for any route that hits a warehouse or slow/rate-limited API.
  See `references/common-database.md` for the cache helper and the TTL rules below.

### Cache TTL must match the refresh interval

The `api_cache` layer's TTL **must equal the lowest auto-refresh interval the user
can pick from the dropdown.** With the 5-minute floor, that means a **5-minute TTL**
on warehouse routes (not 15 minutes). If the cache TTL is longer than the refresh
interval, the dashboard's "refresh" button visibly does nothing — the UI claims to
fetch fresh data but keeps serving the cached payload until the TTL expires.

If you raise the lowest allowed interval (e.g. only offer 15 min / 1 hour / 1 day in
`INTERVAL_OPTIONS`), match the cache TTL to that floor.

## Cost Control: Warehouse Queries (BigQuery, Snowflake, Databricks)

Warehouse targets are billed per byte scanned. Uncached, unbounded queries against fact
tables can cost thousands of dollars per day per dashboard. Every warehouse-backed route
in a data-visualization artifact **must** follow these rules:

- **Cache every warehouse query** in the `api_cache` table. The cache TTL must match
  the lowest auto-refresh interval offered to the user (default: 5 minutes — see
  the Refresh Floor section above). The cache pattern is non-negotiable for warehouse
  routes — see `references/common-database.md`.
- **Project exact columns** — never `SELECT *` on wide or fact tables.
- **Scope by partition / cluster** — always add a `WHERE <partition_col> >= :start` so
  the warehouse prunes data and you are billed for a slice, not the whole table.
- **Prefer pre-aggregated tables** (`*_daily`, `*_summary`) over raw event tables when
  both are available.
- **Aggregate on the warehouse** — push `GROUP BY`, `SUM`, `COUNT` into SQL. Don't
  stream raw rows to the client and aggregate in JavaScript.
- **Diff-only refresh** — when a dashboard refresh needs to pick up new rows, filter
  on `WHERE updated_at > :last_seen` and store the cursor in Postgres so the refresh
  query only scans the delta. See `references/common-database.md` for the pattern.
- **Schema exploration uses `executeSql` with a `LIMIT`** — never full table scans
  just to "see what's there". Use `INFORMATION_SCHEMA` for structure and `LIMIT 5`–`100`
  for samples.

The `executeSql` tool (used inside the `code_execution` sandbox by the `query-integration-data`
and `database` skills) should NOT be used to power runtime queries for a data-visualization
artifact. Runtime queries belong in the app's API server, wrapped in the `api_cache` layer.

**Note: Databricks Apps are different.** If you are building a Databricks App (deployed
to Databricks's own platform with zero egress and no local Postgres), the `api_cache`
pattern does **not** apply — there is no local DB to cache into. See the `databricks-app`
skill for the SQL discipline + warehouse-side caching rules that replace `api_cache`
in that environment.

## App Type Classification

Classify the user's request into one of three types. If ambiguous, default to Dashboard.

### Dashboard (default)

**Signals:** "dashboard", "monitor", "KPIs", "metrics overview", "analytics", "track", "real-time"

**Layout:** KPI cards + grid of charts + optional detail table. Wide container (`max-w-[1400px]`).

**Read these references:**

- `.local/skills/data-visualization/references/common-bootstrap.md` — Setup and workflow
- `.local/skills/data-visualization/references/dashboard-workflow.md` — Steps 5-6, checklist, subagent template
- `.local/skills/data-visualization/references/dashboard-layout.md` — Grid patterns, KPI cards
- `.local/skills/data-visualization/references/dashboard-controls.md` — Split refresh with auto-refresh, date filters

**Page structure:** See `.local/skills/data-visualization/references/dashboard-page-structure.md` for composition skeleton

---

### Analysis Report

**Signals:** "report", "analysis", "findings", "explain", "why is", "summarize", "readout", "review", "assessment"

**Layout:** Vertical narrative with embedded charts and written analysis. Narrow container (`max-w-[900px]`).

**Read these references:**

- `.local/skills/data-visualization/references/common-bootstrap.md` — Setup and workflow
- `.local/skills/data-visualization/references/report-workflow.md` — Steps 5-6, checklist, subagent template
- `.local/skills/data-visualization/references/report-layout.md` — Executive summary, section cards, recommendations

**Page structure:** See `.local/skills/data-visualization/references/report-page-structure.md` for composition skeleton

---

### Dataset Explorer

**Signals:** "explore", "investigate", "browse", "filter", "drill down", "search data", "let me query", "look through"

**Layout:** Sidebar filters + central data table + reactive charts. Wide container (`max-w-[1600px]`).

**Read these references:**

- `.local/skills/data-visualization/references/common-bootstrap.md` — Setup and workflow
- `.local/skills/data-visualization/references/explorer-workflow.md` — Steps 5-6, checklist, subagent template
- `.local/skills/data-visualization/references/explorer-layout.md` — Filter sidebar, data table, reactive charts

**Page structure:** See `.local/skills/data-visualization/references/explorer-page-structure.md` for composition skeleton

---

## Common References (all types)

These references apply to all three app types. Read as needed:

- `.local/skills/data-visualization/references/common-chart-patterns.md` — CHART_COLORS, CustomTooltip, CustomLegend, dark mode styling, opacity, animation
- `.local/skills/data-visualization/references/common-chart-types.md` — Chart selection guide, area vs line vs bar, pie/donut best practices
- `.local/skills/data-visualization/references/common-controls.md` — Dark mode toggle, PDF export, simple refresh, CSV export per chart
- `.local/skills/data-visualization/references/common-data-sources.md` — Choose between app DB, integrations, CSV, and direct REST APIs
- `.local/skills/data-visualization/references/common-loading-states.md` — Skeleton patterns, loading states, empty states
- `.local/skills/data-visualization/references/common-csv-parsing.md` — PapaParse for client and server CSV handling
- `.local/skills/data-visualization/references/common-color-guide.md` — Color palette, semantic colors, accessibility
- `.local/skills/data-visualization/references/common-css-overrides.md` — Tailwind v4 CSS patches, fonts, shadows, chart colors, print styles
- `.local/skills/data-visualization/references/common-database.md` — Data-viz-specific DB query shaping and DB-backed API caching
- `.local/skills/data-visualization/references/common-data-tables.md` — TanStack React Table with sorting, filtering, pagination
- `.local/skills/data-visualization/references/detailed-analysis.md` — Guide for generating comprehensive analysis reports
- `.local/skills/data-visualization/references/dashboard-page-structure.md` — Dashboard composition skeleton with generated hooks
- `.local/skills/data-visualization/references/report-page-structure.md` — Report composition skeleton with generated hooks
- `.local/skills/data-visualization/references/explorer-page-structure.md` — Explorer composition skeleton with generated hooks

## Handling Truncated Reference Files

**IMPORTANT:** When reading a reference file, the output may be truncated (indicated by `...[Truncated]` at the end). If truncated, note the last line number shown and re-read the file with `offset` set to that line number minus 10 (for overlap). Repeat until no `...[Truncated]` appears. Do not act on partial instructions from a truncated file.
