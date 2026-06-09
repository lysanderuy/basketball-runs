# BallRuns — Database Schema

> Supabase / PostgreSQL · Event-sourced scoring · Linked-list queue

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tables](#tables)
3. [Enums](#enums)
4. [Trigger: Score Sync](#trigger-score-sync)
5. [Queue: Linked List](#queue-linked-list)
6. [Clock Architecture](#clock-architecture)
7. [Row Level Security](#row-level-security)
8. [Indexes](#indexes)
9. [Key Design Decisions](#key-design-decisions)

---

## Architecture Overview

BallRuns uses three user roles — **Host**, **Player**, and **Spectator** — each with different levels of access. The host is the only authenticated user. Players and spectators are guests who join via session code.

All live score updates flow through Supabase Realtime. When the host taps a player to score, a row is inserted into `score_events`. A database trigger fires in the same transaction, recomputing and writing the updated score to `games.score_a` or `games.score_b`. Realtime then broadcasts the updated `games` row to every connected client. No client holds local score state — all clients derive their view from the database.

### Table Relationships

| Table | Belongs To | Has Many |
|---|---|---|
| `users` | — | `runs` |
| `runs` | `users` (host) | `queue_entries`, `games` |
| `queue_entries` | `runs` | `game_players`, `score_events` |
| `games` | `runs` | `game_players`, `score_events` |
| `game_players` | `games`, `queue_entries` | — |
| `score_events` | `games`, `queue_entries` | — |

`queue_entries` also has a self-referential relationship via `after_entry_id` for linked-list ordering.

---

## Tables

---

### `users`

Extends Supabase `auth.users` with app-level profile data. Only account holders have a row here. Guests never appear in this table.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | No | — | PK · mirrors `auth.users(id)` · CASCADE on delete |
| `display_name` | TEXT | No | — | |
| `created_at` | TIMESTAMPTZ | No | `NOW()` | |
| `updated_at` | TIMESTAMPTZ | No | `NOW()` | |

**Constraints**
- `id` references `auth.users(id) ON DELETE CASCADE` — profile is removed when the auth record is deleted
- No email or PII stored here — Supabase Auth owns that

---

### `runs`

One row per session. The top-level unit of organisation for a full open run.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | PK |
| `host_id` | UUID | No | — | FK → `users(id)` · RESTRICT on delete |
| `name` | TEXT | No | — | |
| `location` | TEXT | Yes | — | Optional |
| `format` | `run_format` | No | — | Enum — drives queue auto-update logic |
| `status` | `run_status` | No | `'lobby'` | Enum — lifecycle state |
| `session_code` | TEXT | No | — | Unique · short code for QR join (e.g. `RKR-74`) |
| `created_at` | TIMESTAMPTZ | No | `NOW()` | |
| `updated_at` | TIMESTAMPTZ | No | `NOW()` | |

**Constraints**
- `session_code` is unique across all runs
- `host_id` uses `ON DELETE RESTRICT` — a run cannot be silently orphaned if a user is deleted

**Status lifecycle:** `lobby → active → completed`

---

### `queue_entries`

Every participant in a run — guests and account holders alike. This table is also the queue itself.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | PK |
| `run_id` | UUID | No | — | FK → `runs(id)` · CASCADE on delete |
| `user_id` | UUID | Yes | — | FK → `users(id)` · SET NULL on delete · null for guests |
| `display_name` | TEXT | No | — | Stored as entered · displayed uppercase via CSS |
| `status` | `queue_entry_status` | No | `'waiting'` | Enum |
| `after_entry_id` | UUID | Yes | — | FK → `queue_entries(id)` · SET NULL on delete · `NULL` = head of queue |
| `joined_at` | TIMESTAMPTZ | No | `NOW()` | |
| `updated_at` | TIMESTAMPTZ | No | `NOW()` | |

**Constraints**
- `user_id` is nullable — guests join with a name only, no account needed
- `after_entry_id` self-references `queue_entries(id)` — this is the linked-list pointer. See [Queue: Linked List](#queue-linked-list)
- `ON DELETE SET NULL` on `after_entry_id` — if a referenced node is removed, the pointer becomes null rather than breaking referential integrity

---

### `games`

One game within a run. Contains all clock state and the denormalized score cache.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | PK |
| `run_id` | UUID | No | — | FK → `runs(id)` · CASCADE on delete |
| `game_number` | INTEGER | No | — | Sequential within run (1, 2, 3…) |
| `status` | `game_status` | No | `'pending'` | Enum |
| `score_goal` | INTEGER | No | — | Target score to win (e.g. 21) |
| `time_limit_seconds` | INTEGER | Yes | — | `NULL` = no clock · no clock bar rendered |
| `clock_started_at` | TIMESTAMPTZ | Yes | — | `NULL` until host starts clock |
| `clock_paused_at` | TIMESTAMPTZ | Yes | — | Non-null = clock is currently paused |
| `total_paused_seconds` | INTEGER | No | `0` | Accumulated pause time · used in clock formula |
| `score_a` | INTEGER | No | `0` | **Trigger-maintained** · never written by app directly |
| `score_b` | INTEGER | No | `0` | **Trigger-maintained** · never written by app directly |
| `winner` | `game_winner` | Yes | — | `NULL` until game ends |
| `started_at` | TIMESTAMPTZ | Yes | — | |
| `ended_at` | TIMESTAMPTZ | Yes | — | |
| `created_at` | TIMESTAMPTZ | No | `NOW()` | |
| `updated_at` | TIMESTAMPTZ | No | `NOW()` | |

**Constraints**
- `(run_id, game_number)` is unique — no duplicate game numbers within a run
- `score_a` and `score_b` are never written by the application layer — only the database trigger writes them

**Status lifecycle:** `pending → active → completed`

---

### `game_players`

Join table recording which queue entry played in which game, on which team. Immutable once created.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | PK |
| `game_id` | UUID | No | — | FK → `games(id)` · CASCADE on delete |
| `queue_entry_id` | UUID | No | — | FK → `queue_entries(id)` · RESTRICT on delete |
| `team` | `game_team` | No | — | Enum |
| `created_at` | TIMESTAMPTZ | No | `NOW()` | |

**Constraints**
- `(game_id, queue_entry_id)` is unique — a player cannot be on both teams
- `ON DELETE RESTRICT` on `queue_entry_id` — a queue entry that has game history cannot be removed. The app handles this by setting `status = 'removed'` instead of deleting the row
- No `updated_at` — this record is immutable after creation

---

### `score_events`

The source of truth for all scoring. Rows are inserted on every point scored and soft-voided on undo. Scores are never stored directly — they are always derived from this table by the trigger.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | PK |
| `game_id` | UUID | No | — | FK → `games(id)` · CASCADE on delete |
| `queue_entry_id` | UUID | No | — | FK → `queue_entries(id)` · RESTRICT on delete |
| `team` | `game_team` | No | — | Enum |
| `voided_at` | TIMESTAMPTZ | Yes | — | `NULL` = active point · set = undone |
| `created_at` | TIMESTAMPTZ | No | `NOW()` | Ordering key for the score log |

**Constraints**
- `ON DELETE RESTRICT` on `queue_entry_id` — scoring history is permanent
- No rows in this table are ever hard-deleted

**Derived values**

| Value | Query |
|---|---|
| Team A live score | `COUNT(*) WHERE game_id = ? AND team = 'team_a' AND voided_at IS NULL` |
| Team B live score | `COUNT(*) WHERE game_id = ? AND team = 'team_b' AND voided_at IS NULL` |
| Player points | `COUNT(*) WHERE queue_entry_id = ? AND game_id = ? AND voided_at IS NULL` |
| Score log | `SELECT * WHERE game_id = ? ORDER BY created_at DESC` |

---

## Enums

### `run_format`

| Value | Behaviour |
|---|---|
| `winner_stays` | Winning team stays on court · losing team goes to back of queue |
| `new_ten` | Entirely new 10 players pulled from queue each game |
| `host_decides` | Host manually controls queue composition after each game |

### `run_status`

| Value | Meaning |
|---|---|
| `lobby` | Run created, QR live, no game started yet |
| `active` | At least one game has started |
| `completed` | Run is over |

### `game_status`

| Value | Meaning |
|---|---|
| `pending` | Teams assigned, game not yet started |
| `active` | Game in progress |
| `completed` | Winner declared, game over |

### `game_winner` / `game_team`

| Value | Meaning |
|---|---|
| `team_a` | The "Runs" team — displayed with accent colour |
| `team_b` | The "Next" team — displayed in secondary colour |

### `queue_entry_status`

| Value | Meaning |
|---|---|
| `waiting` | In queue, available to play |
| `marked_out` | Stepped away — greyed out, stays in list, can be reinstated |
| `removed` | Gone for good — excluded from all queue operations |

---

## Trigger: Score Sync

The trigger `trg_score_events_update_game_score` keeps `games.score_a` and `games.score_b` in sync with the contents of `score_events`. It runs inside the same database transaction as the event that caused it — the score cache is always consistent at commit time.

### When it fires

| Event | Trigger action |
|---|---|
| `INSERT` on `score_events` | Recount and update `score_a` / `score_b` |
| `UPDATE OF voided_at` on `score_events` | Recount and update `score_a` / `score_b` |
| Any other `UPDATE` on `score_events` | Does not fire |

### Why a trigger, not an edge function

An edge function would introduce a window between the event INSERT and the score update — during which `score_a` and `score_b` are stale. If the edge function failed, the cache would be permanently wrong. A trigger runs atomically: either both the event and the score update commit, or neither does. There is no gap and no failure mode that leaves the cache inconsistent.

### Security notes

- `SECURITY DEFINER` — the function runs with its owner's privileges, not the calling user's. This allows it to write to `games` even when RLS would otherwise block the caller
- `SET search_path = public` — prevents a malicious schema from shadowing public functions inside the trigger body

### Score update flow

**Scoring a point**

1. Host taps a player name
2. App inserts one row into `score_events` with `game_id`, `queue_entry_id`, `team`
3. Trigger fires — recounts active events for both teams and writes to `games.score_a` / `score_b`
4. Supabase Realtime broadcasts the updated `games` row
5. All connected clients receive the new score — no client-side arithmetic required

**Undoing a point**

1. Host taps Undo
2. App sets `voided_at = NOW()` on the most recent non-voided event
3. Trigger fires — recount produces a value one lower than before
4. Realtime broadcasts the updated `games` row
5. All clients self-correct

---

## Queue: Linked List

The queue is ordered via a singly linked list. Each `queue_entries` row holds a pointer — `after_entry_id` — to the entry it follows. A `NULL` pointer means the entry is at the head of the queue.

### Why a linked list over integer ranks

With integer ranks, reordering a player requires updating every row below them in the queue. With a linked list, any reorder only touches two or three rows regardless of queue length. For a host dragging players around mid-game, this is meaningfully safer and more efficient.

### Example queue state

| `display_name` | `after_entry_id` | Position |
|---|---|---|
| Marcus | `NULL` | 1st — head of queue |
| Kel | → Marcus | 2nd |
| Tone | → Kel | 3rd |
| D. Webb | → Tone | 4th |
| Junie | → D. Webb | 5th |

### Reorder: move Tone to 2nd position

Before: Marcus → Kel → Tone → D. Webb → Junie

After: Marcus → Tone → Kel → D. Webb → Junie

| Row updated | Change |
|---|---|
| Tone | `after_entry_id` → Marcus |
| Kel | `after_entry_id` → Tone |

Two rows touched. No other rows affected.

### Remove: remove Kel

Before: Marcus → Kel → Tone → D. Webb → Junie

After: Marcus → Tone → D. Webb → Junie

| Row updated | Change |
|---|---|
| Kel | `status` → `removed` |
| Tone | `after_entry_id` → Marcus (skip over Kel) |

Kel's row is kept. `ON DELETE RESTRICT` on `queue_entry_id` in `game_players` and `score_events` means a row with game history can never be hard-deleted. The app always sets `status = 'removed'` rather than issuing a DELETE.

### Reading the queue in order

The ordered list is reconstructed by traversing from the entry with `after_entry_id = NULL` (head), following each pointer until the tail. This traversal happens in the app layer. A Postgres recursive CTE can also compute it server-side when the full ordered list is needed in a single query.

---

## Clock Architecture

The game clock never ticks on any device. When the host starts the clock, the server stores a timestamp. Every client independently computes the remaining time by subtracting elapsed time from the limit.

### Clock formula

```
remaining = time_limit_seconds − (NOW() − clock_started_at − total_paused_seconds)
```

Any client connecting mid-game computes the correct remaining time immediately from four values already on the `games` row: `time_limit_seconds`, `clock_started_at`, `clock_paused_at`, and `total_paused_seconds`. No sync is required. No drift is possible.

### Clock state on the `games` row

| Column | Running | Paused |
|---|---|---|
| `clock_started_at` | Set (timestamp) | Set (unchanged) |
| `clock_paused_at` | `NULL` | Set (timestamp of pause) |
| `total_paused_seconds` | Accumulated total | Accumulated total (not yet including current pause) |

### Pause flow

1. Host taps Pause
2. App sets `clock_paused_at = NOW()` on the `games` row
3. Realtime broadcasts — all clients see `clock_paused_at` is non-null and freeze display

### Resume flow

1. Host taps Resume
2. App computes `paused_duration = NOW() − clock_paused_at`
3. App sets `total_paused_seconds = total_paused_seconds + paused_duration` and `clock_paused_at = NULL`
4. Realtime broadcasts — all clients resume ticking from the correct position

---

## Row Level Security

Full policy SQL lives in migration files. This table describes the intended access shape per role.

| Table | Read | Insert | Update |
|---|---|---|---|
| `users` | Own row only | — | Own row only |
| `runs` | `session_code` match · or own run | Host only | Host only |
| `queue_entries` | Run accessible to caller | Anyone (guest join) | Host of run only |
| `games` | Run accessible to caller | Host only | Host only |
| `game_players` | Run accessible to caller | Host only | — |
| `score_events` | Run accessible to caller | Host only | Host only (`voided_at` only) |

**Note:** The score trigger runs as `SECURITY DEFINER` and intentionally bypasses RLS. It is the only writer to `games.score_a` and `games.score_b`.

---

## Indexes

| Table | Index | Type | Purpose |
|---|---|---|---|
| `users` | `idx_users_created_at` | Standard | Run history pagination |
| `runs` | `uq_runs_session_code` | Unique | QR join lookup |
| `runs` | `idx_runs_host_id` | Standard | Host's run history |
| `runs` | `idx_runs_status` | Standard | Active run queries |
| `queue_entries` | `idx_queue_entries_run_id` | Standard | Queue page load |
| `queue_entries` | `idx_queue_entries_user_id` | Standard | Player's run history |
| `queue_entries` | `idx_queue_entries_after_entry_id` | Standard | Linked list traversal |
| `games` | `uq_games_run_id_game_number` | Unique | Game numbering integrity |
| `games` | `idx_games_run_id` | Standard | Run feed load |
| `games` | `idx_games_status` | Standard | Active game queries |
| `game_players` | `uq_game_players_game_entry` | Unique | Duplicate prevention |
| `game_players` | `idx_game_players_game_id` | Standard | Team load per game |
| `game_players` | `idx_game_players_queue_entry_id` | Standard | Player game history |
| `score_events` | `idx_score_events_game_id` | Standard | Full game event log |
| `score_events` | `idx_score_events_game_voided` | **Partial** `WHERE voided_at IS NULL` | Live score queries — active events only |
| `score_events` | `idx_score_events_queue_entry_id` | Standard | Per-player points |

The partial index on `score_events (game_id, voided_at) WHERE voided_at IS NULL` is the most performance-critical index in the schema. Every live score query filters on exactly these conditions. The partial index covers them entirely without scanning voided rows.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Score storage | Event sourcing via `score_events` | Score is always derivable from source — survives refresh, reconnects, and undo with no client state |
| Score cache | Denormalized `score_a` / `score_b` on `games` | Cheap reads for the feed and results screens without aggregating all events on every request |
| Cache sync | Database trigger | Atomically consistent — the cache updates in the same transaction as the event. An edge function would introduce a consistency gap |
| Queue ordering | Linked list via `after_entry_id` | Reorders touch 2–3 rows regardless of queue size. Integer ranks require updating every row below the moved entry |
| Guest players | Nullable `user_id` on `queue_entries` | Guests join with name only — no friction. Account linking is optional and additive |
| Clock | Server timestamps, client formula | Zero drift. Survives reconnects. No server-side interval or cron required |
| Undo | Soft void via `voided_at` | Non-destructive. Full history is preserved. The trigger recounts on void and the score self-corrects |
| Hard delete prevention | `ON DELETE RESTRICT` on game history FKs | Prevents orphaning game records. Removals are always logical status changes, never physical deletes |

