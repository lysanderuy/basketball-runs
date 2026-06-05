# BallRuns — Claude Instructions

This file governs every AI session in this repo. Read it fully before touching any file.

---

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript — strict mode |
| Database | Supabase (PostgreSQL) |
| ORM | Drizzle ORM |
| Migrations | `node-pg-migrate` — JS builder API (`db/migrations/`) |
| Auth | Supabase Auth + `@supabase/ssr` |
| Validation | Zod |
| Styling | Tailwind CSS |
| UI primitives | Radix UI |

---

## Project Structure

```
app/
├── page.tsx                        Landing
├── auth/                           Auth pages + server actions
├── (protected)/                    Host-only pages — auth guard in layout.tsx
├── runs/[code]/                    Run-scoped pages
│   ├── layout.tsx                  Run shell — fetches run, provides context
│   ├── lobby/
│   ├── team-assignment/
│   ├── results/
│   └── (session)/                  Pages with bottom nav (game, queue, feed)
└── api/                            All HTTP endpoints
    ├── auth/callback/
    ├── runs/
    └── users/

lib/
├── db/
│   ├── schema.ts                   Single source of truth for all tables
│   └── index.ts                    Drizzle client
├── supabase/
│   ├── client.ts                   Browser client
│   ├── server.ts                   Server client
│   └── proxy.ts                    Middleware session refresh
└── validations/
    └── index.ts                    All Zod schemas

services/                           Business logic — called by API routes only
hooks/                              Client-side React hooks
types/
└── db.ts                           Drizzle inferred types ($inferSelect)
```

---

## Data Flow — One Direction Only

```
UI (pages/components)
  → fetch /api/...
    → app/api/**/route.ts       validate with Zod, call service
      → services/               business logic, no HTTP knowledge
        → lib/db/               Drizzle queries only
```

**Never skip a layer.** UI never imports from `services/`. Services never import from `app/`. API routes never contain business logic — they validate and delegate.

**Exception:** Server Components may read from Supabase directly for page data fetching. Writes always go through API routes.

---

## What Goes Where

### API routes (`app/api/`)
- Validate request body with Zod (`safeParse` — never `parse`)
- Call a service function
- Return `NextResponse.json()`
- No DB queries directly in route handlers

### Services (`services/`)
- All DB queries live here
- No `NextRequest`, `NextResponse`, or any HTTP concept
- No Zod — validation happens in API routes before services are called
- Pure functions: take typed inputs, return typed outputs

### Lib (`lib/`)
- `lib/db/schema.ts` — table definitions only, no queries
- `lib/db/index.ts` — Drizzle client only
- `lib/validations/` — Zod schemas only
- `lib/utils.ts` — pure utility functions (cn, formatTime, etc.)

### Types (`types/`)
- `types/db.ts` — only `$inferSelect` and `$inferInsert` from Drizzle tables
- No manually written interfaces that duplicate the schema

### Hooks (`hooks/`)
- Client-side only (`"use client"` context)
- Supabase Realtime subscriptions live here
- No direct DB access — hooks call API routes or subscribe via Realtime

---

## Auth Model

| Role | Account | Access |
|---|---|---|
| Host | Required | Full control — create run, manage queue, score, clock |
| Player | Guest (optional) | Join queue, view live score |
| Spectator | Guest | Read-only |

- Middleware (`lib/supabase/proxy.ts`) is the auth enforcement layer — redirects unauthenticated users away from `/create-run`, `/history`, `/account`
- `(protected)/layout.tsx` is a pure passthrough — do not add auth checks here
- RLS enforces authorization at the DB level — do not re-implement access checks in services
- Guest mutations (join queue) go through API routes — RLS `WITH CHECK (true)` allows them

---

## Schema Rules

These are non-negotiable — violations break the app silently.

- **`games.score_a` and `games.score_b` are trigger-maintained.** Never write them from application code. Only `score_events` inserts/voids affect them.
- **Queue ordering is a linked list.** Order is encoded via `queue_entries.after_entry_id` (NULL = head). Never use integer positions or ORDER BY `joined_at` to determine queue order.
- **Never hard-delete `queue_entries` with game history.** `game_players` and `score_events` have `ON DELETE RESTRICT` on `queue_entry_id`. Always set `status = 'removed'` instead.
- **`users.id` mirrors `auth.users.id`.** The row is created by trigger, not by the app. Never insert into `users` manually.
- **`session_code` is the public identifier for a run.** URLs use `[code]` not `[id]`.

---

## Migration Rules

Drizzle Kit is **not used**. Migrations are JS files managed by `node-pg-migrate`, applied directly via `DIRECT_URL`.

```bash
# Any schema change (table, column, index, RLS, trigger):
# 1. Scaffold:
npm run db:migrate:create -- <description>
# 2. Edit the generated file in db/migrations/
# 3. Apply:
npm run db:migrate
# Roll back last migration:
npm run db:migrate:down
```

**Naming:** `node-pg-migrate` prefixes files with a timestamp automatically — do not rename them.

- **Never edit a migration file after it has been applied** — write a new one
- `lib/db/schema.ts` is the Drizzle ORM definition — keep it in sync with migrations manually
- RLS policies and triggers go in migration files using `pgm.sql()`
- `supabase/migrations/` contains legacy SQL files (already applied) — do not touch them
- Runner script: `tools/run-pg-migrate.mjs` — loads `DIRECT_URL` from `.env`

---

## Zod Usage

```ts
// In API routes — always use safeParse, never parse
const result = createRunSchema.safeParse(await req.json())
if (!result.success) {
  return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
}
// result.data is now typed and safe to pass to a service
```

- All schemas live in `lib/validations/index.ts`
- Export both the schema and the inferred type: `export type CreateRunInput = z.infer<typeof createRunSchema>`
- Enum values in Zod schemas must match the Drizzle enum values exactly

---

## Supabase Realtime

- Realtime subscriptions belong in `hooks/` — never in Server Components or API routes
- Subscribe to the `games` table for live score updates (the trigger keeps it in sync)
- Subscribe to `queue_entries` for live queue updates
- Always unsubscribe on component unmount — use the `useEffect` cleanup return

---

## Next.js 15 — Dynamic Rendering

Next.js 15 requires explicit opt-in for any layout or page that accesses request-time data. Without it, the route throws a "blocking route" error.

**Rule: any layout or page that accesses `params`, `searchParams`, `cookies()`, or `headers()` must declare:**

```ts
export const dynamic = "force-dynamic";
```

This applies to:
- Layouts that read `params` to fetch data (e.g. `runs/[code]/layout.tsx`)
- API routes do NOT need it — they are always dynamic
- Client components (`"use client"`) do NOT need it — they run in the browser
- Pure passthrough layouts with no data access do NOT need it

Auth is enforced by middleware, not layouts. Do not add auth checks to layouts — this was the original cause of the `(protected)/layout.tsx` error.

---

## What NOT To Do

- Do not use `drizzle-kit` — it is removed
- Do not use `supabase db push` — migrations now go through `node-pg-migrate`
- Do not write to `games.score_a` or `games.score_b` from app code
- Do not hard-delete queue entries — set `status = 'removed'`
- Do not query `lib/db/` from inside `app/` pages or components
- Do not put business logic in API route handlers — put it in `services/`
- Do not use `z.parse()` in API routes — always `z.safeParse()`
- Do not add Zod validation inside services — services trust their inputs
- Do not use integer rank columns for queue ordering — the linked list is the order
- Do not create new files unless the task requires it
- Do not add comments explaining what code does — only add comments explaining why when the reason is non-obvious
