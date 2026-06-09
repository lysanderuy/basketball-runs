# BallRuns

BallRuns is the sideline tool for running pickup basketball. Hosts manage queues, run games, and track scores in real time — while players just show up and play.

## What is BallRuns?

BallRuns keeps the chaos out of pickup basketball. Hosts create a run and share a 6-character code. Players scan in, join the queue, and wait their turn. The host assigns teams, scores points, and runs the clock — all from their phone. Everyone sees the same live state without refreshing.

## Core Principles

**Host-first design.** The host is managing a game on a court, not sitting at a desk. Every action should be fast and obvious.

**Real-time by default.** Queue changes and score updates push to all connected clients instantly. Nobody should be looking at stale state.

**Zero friction for players.** Players join with a name and a code — no account, no download, no friction.

**Scores are events, not edits.** Every point is logged as a `score_events` row. Undo doesn't delete — it voids. The record stays intact and a trigger keeps `games.score_a` / `score_b` in sync.

**Queue order is explicit.** Order is an integer `position` column maintained by a database trigger on game completion. The host never sorts by timestamp.

## Who Should Use BallRuns

**Run organizers.** People who host recurring pickup sessions and want structure without spreadsheets.

**Gym and court managers.** Anyone managing a rotating queue of teams across multiple games.

**Casual groups.** Friend groups who want a fair, visible queue instead of "who called next?"

## Key Features

**Session codes.** Share a 6-character `session_code` to bring players into your run — no accounts needed on their end.

**Live queue management.** Add players, reorder the queue, mark players out, or pull them back — with changes reflected instantly for everyone via Supabase Realtime.

**Team assignment.** Pick who plays before each game starts. Drag from the queue directly into Team A or Team B.

**Live scoreboard.** Log points by team. Undo any point without losing the audit trail — `score_events` is voided, not deleted.

**Game clock.** Optional countdown timer with pause and resume. Paused time is tracked separately so the clock stays accurate.

**Run formats.** Supports Winner Stays, New Ten, and Host Decides formats. The DB trigger rotates the queue according to the run's format on game completion.

**Game history.** Every game, team lineup, and point event is stored. Past games are always viewable from the feed.

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript (strict)
- **Supabase** — PostgreSQL, Auth, Realtime
- **Drizzle ORM** for typed schema access
- **node-pg-migrate** (JS builder API) for migrations
- **Zod** for validation
- **Tailwind CSS** + **Radix UI** primitives

## Project Structure

```
basketball-runs/
├── src/
│   ├── app/
│   │   ├── page.tsx                  Landing
│   │   ├── auth/                     Login, signup, OAuth callback
│   │   ├── (protected)/              Host-only pages (create-run, history, account)
│   │   ├── runs/[code]/
│   │   │   ├── layout.tsx            Passthrough — no data fetch
│   │   │   ├── join/                 Guest join flow
│   │   │   ├── team-assignment/      Assign players to teams before tip-off
│   │   │   ├── results/              Post-game summary
│   │   │   └── (session)/            Pages with bottom nav
│   │   │       ├── layout.tsx        BottomNav wrapper
│   │   │       ├── game/             Live game management
│   │   │       ├── queue/            Queue view
│   │   │       ├── feed/             Run feed (game list)
│   │   │       └── feed/[gameId]/    Single game detail
│   │   └── api/                      All HTTP endpoints (runs, games, queue, score, clock)
│   ├── components/                   Shared UI components
│   ├── hooks/                        Client-side Realtime subscriptions
│   ├── lib/
│   │   ├── db/                       Drizzle schema + client
│   │   ├── supabase/                 Browser, server, and middleware clients
│   │   ├── validations/              Zod schemas
│   │   └── utils.ts                  Pure utility helpers
│   ├── services/                     Business logic — called by API routes only
│   ├── types/                        Drizzle-inferred types
│   └── middleware.ts                 Auth guard for (protected) routes
├── db/
│   └── migrations/                   node-pg-migrate JS files
├── docs/                             Product brief, schema reference, design notes
├── tools/
│   └── run-pg-migrate.mjs            Migration runner (loads DIRECT_URL)
├── tailwind.config.ts
├── next.config.ts
└── proxy.ts                          Next.js 15 instrumentation proxy
```

## Data Flow

One direction only:

```
UI (pages/components)
  → fetch /api/...
    → app/api/**/route.ts       validate with Zod, call service
      → services/               business logic, no HTTP knowledge
        → lib/db/               Drizzle queries only
```

- UI never imports from `services/`.
- Services never import from `app/`.
- API routes never contain business logic — they validate and delegate.
- Server Components may read from Supabase directly for page data fetching. Writes always go through API routes.

## Schema Highlights

These invariants are enforced in the database and must be respected by application code:

- **`games.score_a` and `games.score_b` are trigger-maintained.** Never write them from app code — only `score_events` inserts/voids change them.
- **Queue ordering is the integer `position` column.** Read with `ORDER BY position ASC`. Never sort by `joined_at`.
- **Queue rotation is trigger-maintained.** `trg_rotate_queue_on_game_complete` rewrites `queue_entries.position` on every game → `completed` transition. Never rotate the queue from app code.
- **Never hard-delete `queue_entries` with game history.** `game_players` and `score_events` have `ON DELETE RESTRICT`. Set `status = 'removed'` instead.
- **`users.id` mirrors `auth.users.id`.** The row is created by trigger, not by the app.
- **`session_code` is the public identifier for a run.** URLs use `[code]`, not `[id]`.

## Setup

1. Install dependencies
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your Supabase credentials (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DIRECT_URL`)

3. Apply the database migrations
   ```bash
   npm run db:migrate
   ```

4. Start the dev server
   ```bash
   npm run dev
   ```

App runs at [localhost:3000](http://localhost:3000).

## Migrations

Drizzle Kit is not used. Migrations are JS files in `db/migrations/`, applied via `node-pg-migrate` against `DIRECT_URL`.

```bash
# Scaffold a new migration
npm run db:migrate:create -- <description>

# Apply pending migrations
npm run db:migrate

# Roll back the last migration
npm run db:migrate:down
```

- Never edit a migration file after it has been applied — write a new one.
- Keep `src/lib/db/schema.ts` in sync with migration changes manually.
- RLS policies and triggers go in migration files using `pgm.sql()`.
- `supabase/migrations/` contains legacy SQL files (already applied) — do not touch.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on `0.0.0.0:3000` |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:migrate:down` | Roll back the last migration |
| `npm run db:migrate:create -- <desc>` | Scaffold a new migration file |

## Auth Model

| Role | Account | Access |
|---|---|---|
| Host | Required | Full control — create run, manage queue, score, clock |
| Player | Guest (optional) | Join queue, view live score |
| Spectator | Guest | Read-only |

- `src/middleware.ts` is the auth enforcement layer — redirects unauthenticated users away from `/create-run`, `/history`, `/account`.
- RLS enforces authorization at the DB level — do not re-implement access checks in services.
- Guest mutations (join queue) go through API routes — RLS `WITH CHECK (true)` allows them.

## References

- Product brief: `docs/ballruns-product-brief.md`
- Schema reference: `docs/ballruns-schema.md`
- Authoritative project rules: `CLAUDE.md`
