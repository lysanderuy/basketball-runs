# BallRuns — Database Behavior

> **Tables, columns, types, defaults, FKs, indexes, and enum values: see [`src/lib/db/schema.ts`](../src/lib/db/schema.ts) — that is the source of truth.**
>
> This document covers only what schema.ts *can't* encode: triggers, the cron
> job, RLS policy shape, how scores are derived, the clock model, and the design
> decisions behind them. If you're looking for "what columns does table X have,"
> read schema.ts, not this file.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Enum Semantics](#enum-semantics)
3. [Scoring — Event Sourced](#scoring--event-sourced)
4. [Triggers](#triggers)
5. [Cron — Timed Game Expiry](#cron--timed-game-expiry)
6. [Queue Ordering](#queue-ordering)
7. [Clock Architecture](#clock-architecture)
8. [Row Level Security](#row-level-security)
9. [Key Design Decisions](#key-design-decisions)

---

## Architecture Overview

BallRuns has three roles — **Host**, **Player**, **Spectator**. The host is the
only authenticated user; players and spectators are guests who join via session
code. URLs use the public `session_code` (`runs/[code]`), never the run UUID.

All live updates flow through Supabase Realtime. No client holds local score
state — every client derives its view from the database. When the host scores, a
row is inserted into `score_events`; a trigger recomputes `games.score_a` /
`score_b` in the same transaction; Realtime broadcasts the updated `games` row.

### Relationships

```
users ──< runs ──< queue_entries ──< game_players >── games
                         │                              │
                         └──────< score_events >────────┘
```

- `runs.host_id → users.id` (RESTRICT)
- `queue_entries.run_id → runs.id` (CASCADE), `queue_entries.user_id → users.id` (SET NULL, null for guests)
- `game_players` / `score_events` → `queue_entries.id` is **RESTRICT** — an entry with game history can never be hard-deleted. Removal is always `status = 'removed'`, never a DELETE.

---

## Enum Semantics

Values live in schema.ts. What each value *means* / *drives*:

### `run_format` — drives queue rotation on game completion

| Value | Behavior |
|---|---|
| `winner_stays` | Winning team stays on court; losing team rotates to the back |
| `new_ten` | Every player in the game rotates to the back (fresh ten next game) |
| `host_decides` | No auto-rotation — host manages the queue manually |

A `tie` result rotates **all** players regardless of `winner_stays` (no team earned the right to stay). See [Triggers](#triggers).

### `run_point_system` — which point values are legal

| Value | Allowed `score_events.points` |
|---|---|
| `one_two` | 1, 2 |
| `two_three` | 2, 3 |

Enforced in the score API route against `runs.point_system` before the service runs.

### `game_winner`

`team_a` · `team_b` · `tie`. NULL until the game ends. `tie` is set when scores are equal at expiry or at goal.

### Status enums

- `run_status`: `lobby → active → completed`
- `game_status`: `pending → active → completed`
- `queue_entry_status`: `waiting` (in queue) · `marked_out` (stepped away, reinstatable) · `removed` (gone for the day, excluded from all queue ops)

---

## Scoring — Event Sourced

`score_events` is the source of truth. Each point scored inserts one row carrying
its weight in `points` (1, 2, or 3). Undo is a **soft void** (`voided_at = NOW()`),
never a delete. `games.score_a` / `score_b` are a denormalized cache, **never
written by application code** — only the sync trigger writes them.

Derived values (note: **`SUM(points)`**, not `COUNT(*)` — points are weighted):

| Value | Query |
|---|---|
| Team A live score | `SUM(points) WHERE game_id = ? AND team = 'team_a' AND voided_at IS NULL` |
| Team B live score | `SUM(points) WHERE game_id = ? AND team = 'team_b' AND voided_at IS NULL` |
| Player points | `SUM(points) WHERE queue_entry_id = ? AND game_id = ? AND voided_at IS NULL` |
| Games played | `COUNT(*)` of `game_players` rows joined to `games` where `status = 'completed'` — there is **no stored counter** |
| Score log | `SELECT * WHERE game_id = ? AND voided_at IS NULL ORDER BY created_at DESC` |

---

## Triggers

All trigger functions are `SECURITY DEFINER SET search_path = public` so they can
write past RLS, and run inside the caller's transaction (atomic, no gap).

### `trg_score_events_update_game_score` → `sync_game_score()`

- Fires: `AFTER INSERT OR UPDATE OF voided_at ON score_events`
- Action: recomputes `games.score_a` / `score_b` as `COALESCE(SUM(points), 0)` per team over non-voided events. Insert raises the score; voiding lowers it; all clients self-correct via Realtime.
- Why a trigger, not an edge function: an edge function would leave a window where the cache is stale, and a permanent inconsistency if it failed. The trigger commits with the event or not at all.

### `trg_rotate_queue_on_game_complete` → `rotate_queue_on_game_complete()`

- Fires: `AFTER UPDATE OF status ON games`, only on the first `OLD.status <> 'completed' → NEW.status = 'completed'` transition.
- Action: rewrites `queue_entries.position` to append the rotated players after the current max position, preserving their relative order. Who rotates depends on `run_format`: `host_decides` = nobody; `new_ten` or `winner = 'tie'` = everyone in the game; `winner_stays` = the losing team only.
- **This is the single source of truth for rotation.** It fires on *every* completion path — host "End game", score-to-goal auto-complete, and the cron expiry job. Never rotate the queue from application code.

### `trg_clear_sitting_out_on_game_advance` → `clear_sitting_out_on_game_advance()`

- Fires: `AFTER UPDATE ON games`.
- Action: when a game in the run first leaves `pending` (goes `active` or `completed`), clears `sitting_out = false` for every entry in that run. So a player benched for one game ("Bench for next game") resurfaces automatically the following round. Distinct from `status = 'marked_out'`, which is a hard day-long removal.

---

## Cron — Timed Game Expiry

A **pg_cron** job `expire-timed-games` runs every minute:

```
UPDATE games SET status = 'completed', ended_at = NOW(), clock_paused_at = NOW(),
  winner = CASE WHEN score_a = score_b THEN 'tie'
                WHEN score_a > score_b THEN 'team_a' ELSE 'team_b' END
WHERE status = 'active' AND time_limit_seconds IS NOT NULL
  AND clock_started_at IS NOT NULL AND clock_paused_at IS NULL
  AND EXTRACT(EPOCH FROM (NOW() - clock_started_at))::int - total_paused_seconds >= time_limit_seconds;
```

This guarantees a timed game ends even if no host client is open. Because it sets
`status = 'completed'`, the rotation trigger fires and the queue rotates — the
app, the score auto-complete, and cron all share one rotation path. Defined in
the `add-pg-cron-expire-games` / `add-game-winner-tie` migrations.

---

## Queue Ordering

The queue is ordered by the integer column `queue_entries.position` — **lower =
front**. Read order with `ORDER BY position ASC`. (The original `after_entry_id`
linked list was dropped in migration `1781020049924`; positions were backfilled
from the list.)

- **Join**: new entry takes `MAX(position) + 1` under a per-run advisory lock so concurrent joins can't collide.
- **Rotation**: handled exclusively by `trg_rotate_queue_on_game_complete` (above).
- **Removal**: set `status = 'removed'` — never DELETE (RESTRICT FKs on game history).

---

## Clock Architecture

The clock never ticks on any device. The server stores timestamps; every client
computes remaining time independently — zero drift, survives reconnects, no
client-held state.

```
remaining = time_limit_seconds − ((NOW() − clock_started_at) − total_paused_seconds − [paused now ? NOW() − clock_paused_at : 0])
```

Four columns carry the whole model: `time_limit_seconds`, `clock_started_at`,
`clock_paused_at` (non-null ⇒ paused), `total_paused_seconds`.

- **Pause**: set `clock_paused_at = NOW()`. Idempotent — pausing an already-paused clock is a no-op, so paused time already accrued is never erased.
- **Resume**: `total_paused_seconds += NOW() − clock_paused_at`, then `clock_paused_at = NULL`. Idempotent — resuming a running clock is a no-op.

The cron expiry job reads `games.time_limit_seconds` (copied from the run at game
creation), so a game's deadline is fixed at creation and unaffected by later run
edits.

---

## Row Level Security

Full policy SQL: `supabase/migrations/0003_rls.sql` (legacy, already applied — do
not edit). Intended access shape:

| Table | Read | Insert | Update |
|---|---|---|---|
| `users` | Own row (authenticated) | — (trigger-created) | Own row |
| `runs` | Authenticated: own run or a run they have an entry in · Anon: **all** (QR lookup by code) | Host (`host_id = auth.uid()`) | Host |
| `queue_entries` | **Anyone** (guests/spectators need the list) | **Anyone** (guest join, `WITH CHECK true`) | Host of the run only |
| `games` | Anyone | Host of the run | Host of the run |
| `game_players` | Anyone | Host of the run | — (immutable) |
| `score_events` | Anyone | Host of the run | Host of the run (undo / `voided_at`) |

The score-sync, rotation, and sitting-out triggers run `SECURITY DEFINER` and
intentionally bypass RLS — they are the only writers to `games.score_a/score_b`
and to trigger-driven `queue_entries.position` / `sitting_out`.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Score storage | Event sourcing via `score_events` (weighted `points`) | Always derivable — survives refresh, reconnect, undo with no client state |
| Score cache | Denormalized `score_a` / `score_b` on `games` | Cheap reads for feed/results without aggregating every event per request |
| Cache sync | DB trigger (`SUM(points)`) | Atomically consistent; an edge function would leave a stale window |
| Queue ordering | Integer `position` | Simple `ORDER BY`; rotation is a bounded `UPDATE` driven by one trigger |
| Queue rotation | Trigger on game completion | One source of truth shared by host, score auto-complete, and cron — no path can skip it |
| Timed expiry | pg_cron every minute | Games end even with no host client open; reuses the rotation trigger |
| Guest players | Nullable `user_id` | Join with a name only — no friction; account linking is optional |
| Clock | Server timestamps + client formula, idempotent pause/resume | Zero drift; survives reconnect; re-pause/-resume can't corrupt paused time |
| Undo | Soft void via `voided_at` | Non-destructive; trigger recounts and the score self-corrects |
| Hard-delete prevention | `ON DELETE RESTRICT` on game-history FKs | No orphaned game records; removals are logical (`status`), never physical |
