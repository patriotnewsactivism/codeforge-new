# App Database Access (Drizzle ORM)

Use the shared monorepo references as the source of truth:

- The `pnpm-workspace` skill's `references/db.md` for how to use the database
- The `pnpm-workspace` skill's `references/server.md` for building the endpoints

This reference only covers the data-visualization-specific parts that sit on top of those shared rules.

## When to Use the App DB

- Use the app DB when the user is exploring or reporting on data your app already owns.
- Keep external integrations separate. Fetch upstream data in the API layer and only persist/cache it in Postgres when that materially improves latency or reliability.

## Shape Endpoints for Visualizations

- Prefer chart-ready responses over one giant generic endpoint.
- Push filtering, grouping, and aggregation into SQL for large datasets.
- Return stable numeric/date fields that map cleanly into charts, tables, and summary cards.
- Split endpoints by purpose when helpful:
  - raw rows for tables and explorers
  - aggregated series for charts
  - KPI/summary payloads for cards

Example query shape:

```typescript
const revenueByDate = await db
  .select({
    date: sql<string>`DATE(${ordersTable.createdAt})`,
    revenue: sql<number>`SUM(${ordersTable.amount})`,
  })
  .from(ordersTable)
  .groupBy(sql`DATE(${ordersTable.createdAt})`)
  .orderBy(sql`DATE(${ordersTable.createdAt})`);
```

If the visualization supports a user-selected time range, apply the already-validated range in SQL instead of filtering in the frontend:

```typescript
const revenueByDate = await db
  .select({
    date: sql<string>`DATE(${ordersTable.createdAt})`,
    revenue: sql<number>`SUM(${ordersTable.amount})`,
  })
  .from(ordersTable)
  .where(sql`${ordersTable.createdAt} BETWEEN ${startDate} AND ${endDate}`)
  .groupBy(sql`DATE(${ordersTable.createdAt})`)
  .orderBy(sql`DATE(${ordersTable.createdAt})`);
```

Here, `startDate` and `endDate` should come from params that were already parsed and validated using the `pnpm-workspace` skill's `references/server.md` patterns.

The route that uses this query should still follow the `pnpm-workspace` skill's `references/server.md` for parsing, validation, and response handling.

## DB-Backed API Response Cache

For external-API routes that are slow (>10s) or share a rate-limited token, cache
responses in Postgres. This replaces any in-memory caching pattern.

**Cache TTL must match the lowest auto-refresh interval offered to the user.** The
data-visualization skill ships with a 5-minute refresh floor (see
`dashboard-controls.md`), so the default TTL for warehouse and slow-API routes is
**5 minutes**. If the dashboard raises its floor (e.g. only offers 15 min / 1 hour /
1 day intervals), match the TTL to that floor. A TTL that's longer than the refresh
interval makes the Refresh button visibly do nothing.

For slow third-party APIs with no user-facing refresh control, a 15-minute TTL is a
reasonable default — but warehouse routes that are wired into the dashboard's refresh
button must respect the floor described above.

**Warehouse routes (`bigquery`, `snowflake`, `databricks`) MUST use this cache** — see
`common-data-sources.md`. Warehouse queries are billed per byte scanned and a single
uncached dashboard refresh can cost dollars.

### Warehouse query discipline (cost control)

Every warehouse-backed route must follow these rules — the cache above only helps
within the 15-minute window, so the underlying query itself must also be cheap:

- **Project exact columns** — never `SELECT *` on wide or fact tables.
- **Scope by partition / cluster** — always add a `WHERE event_date >= :start` (or
  equivalent partition/cluster filter) so the warehouse scans a slice, not the whole
  table. BigQuery, Snowflake, and Databricks all prune aggressively when filtered on
  a partition column.
- **Prefer pre-aggregated tables** (`*_daily`, `*_summary`) over raw event tables
  when both are available.
- **Limit what you send to the client** — aggregate on the warehouse side (SQL
  `GROUP BY`, `SUM`, `COUNT`). Do not stream raw rows to the frontend and then
  aggregate in JavaScript.

### Diff-only (incremental) fetches

For dashboards that display a live-updating dataset, don't re-scan the whole table on
every refresh. Persist a high-water mark in Postgres and only query the delta:

```typescript
import { db } from "@workspace/db";
import { warehouseCursorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function fetchNewEvents(): Promise<Event[]> {
  const [cursor] = await db
    .select()
    .from(warehouseCursorsTable)
    .where(eq(warehouseCursorsTable.key, "events"));

  const since = cursor?.lastSeenAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Scans only rows updated since the last fetch — tiny byte scan.
  const rows = await runWarehouseQuery<Event>(
    `SELECT id, user_id, type, updated_at
     FROM \`project.dataset.events\`
     WHERE updated_at > @since
     ORDER BY updated_at ASC
     LIMIT 10000`,
    { since: since.toISOString() },
  );

  if (rows.length > 0) {
    const newHighWater = rows[rows.length - 1].updated_at;
    await db
      .insert(warehouseCursorsTable)
      .values({ key: "events", lastSeenAt: newHighWater })
      .onConflictDoUpdate({
        target: warehouseCursorsTable.key,
        set: { lastSeenAt: newHighWater },
      });
  }

  return rows;
}
```

Combine diff-only fetches with the `api_cache` layer: the cache key should include the
`since` cursor so a second request within the TTL returns the cached result, and a
later request after new data arrives re-runs only the small delta query.

### Schema (`lib/db/src/schema/apiCache.ts`)

```typescript
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const apiCacheTable = pgTable("api_cache", {
  cacheKey: text("cache_key").primaryKey(),
  responseData: jsonb("response_data").notNull(),
  cachedAt: timestamp("cached_at", { withTimezone: true }).defaultNow().notNull(),
});
```

Re-export from `lib/db/src/schema/index.ts` and run `pnpm --filter @workspace/db run push`.

### Cache helper (`artifacts/api-server/src/lib/cache.ts`)

```typescript
import { apiCacheTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";

// 5 minutes — matches the dashboard's lowest refresh interval (see
// dashboard-controls.md). Raise this only if you also raise the lowest
// `INTERVAL_OPTIONS` entry.
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Snap date-like params that are within TTL of "now" to the TTL floor. */
function normalizeParams(params: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const now = Date.now();
  const END_DATE_RE = /date|time|until|end|to|before/i;
  for (const [k, v] of Object.entries(params)) {
    if (END_DATE_RE.test(k)) {
      const ts = new Date(v).getTime();
      if (!isNaN(ts) && Math.abs(ts - now) < CACHE_TTL_MS) {
        const floored = ts - (ts % CACHE_TTL_MS);
        out[k] = new Date(floored).toISOString();
        continue;
      }
    }
    out[k] = v;
  }
  return out;
}

function buildCacheKey(endpoint: string, params: Record<string, string>): string {
  const sorted = Object.fromEntries(
    Object.entries(normalizeParams(params)).sort(([a], [b]) => a.localeCompare(b)),
  );
  return `${endpoint}:${JSON.stringify(sorted)}`;
}

export async function getCached(key: string): Promise<unknown | null> {
  const [row] = await db
    .select()
    .from(apiCacheTable)
    .where(eq(apiCacheTable.cacheKey, key));
  if (!row) return null;
  if (Date.now() - row.cachedAt.getTime() > CACHE_TTL_MS) return null;
  return row.responseData;
}

export async function setCache(key: string, data: unknown): Promise<void> {
  await db
    .insert(apiCacheTable)
    .values({ cacheKey: key, responseData: data, cachedAt: new Date() })
    .onConflictDoUpdate({
      target: apiCacheTable.cacheKey,
      set: { responseData: data, cachedAt: new Date() },
    });
}

export { buildCacheKey };
```

When using cache in a real route:

- Validate and normalize the incoming params using the `pnpm-workspace` skill's `references/server.md` patterns first.
- Build the cache key from those parsed params, not from raw unvalidated input.
- Wrap only the slow upstream fetch with `getCached()` / `setCache()`. Keep the rest of the route thin.
