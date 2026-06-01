import { pgTable, pgEnum, uuid, text, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

export const runFormat = pgEnum('run_format', ['winner_stays', 'new_ten', 'host_decides']);
export const runStatus = pgEnum('run_status', ['lobby', 'active', 'completed']);
export const gameStatus = pgEnum('game_status', ['pending', 'active', 'completed']);
export const gameTeam = pgEnum('game_team', ['team_a', 'team_b']);
export const gameWinner = pgEnum('game_winner', ['team_a', 'team_b']);
export const queueEntryStatus = pgEnum('queue_entry_status', ['waiting', 'marked_out', 'removed']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_users_created_at').on(t.createdAt),
]);

export const runs = pgTable('runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  hostId: uuid('host_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  location: text('location'),
  format: runFormat('format').notNull(),
  status: runStatus('status').notNull().default('lobby'),
  sessionCode: text('session_code').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_runs_session_code').on(t.sessionCode),
  index('idx_runs_host_id').on(t.hostId),
  index('idx_runs_status').on(t.status),
]);

export const queueEntries = pgTable('queue_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  displayName: text('display_name').notNull(),
  status: queueEntryStatus('status').notNull().default('waiting'),
  afterEntryId: uuid('after_entry_id').references((): AnyPgColumn => queueEntries.id, { onDelete: 'set null' }),
  gamesPlayed: integer('games_played').notNull().default(0),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_queue_entries_run_id').on(t.runId),
  index('idx_queue_entries_user_id').on(t.userId),
  index('idx_queue_entries_after_entry_id').on(t.afterEntryId),
]);

export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  gameNumber: integer('game_number').notNull(),
  status: gameStatus('status').notNull().default('pending'),
  scoreGoal: integer('score_goal').notNull(),
  timeLimitSeconds: integer('time_limit_seconds'),
  clockStartedAt: timestamp('clock_started_at', { withTimezone: true }),
  clockPausedAt: timestamp('clock_paused_at', { withTimezone: true }),
  totalPausedSeconds: integer('total_paused_seconds').notNull().default(0),
  scoreA: integer('score_a').notNull().default(0),
  scoreB: integer('score_b').notNull().default(0),
  winner: gameWinner('winner'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_games_run_id_game_number').on(t.runId, t.gameNumber),
  index('idx_games_run_id').on(t.runId),
  index('idx_games_status').on(t.status),
]);

export const gamePlayers = pgTable('game_players', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  queueEntryId: uuid('queue_entry_id').notNull().references(() => queueEntries.id, { onDelete: 'restrict' }),
  team: gameTeam('team').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_game_players_game_entry').on(t.gameId, t.queueEntryId),
  index('idx_game_players_game_id').on(t.gameId),
  index('idx_game_players_queue_entry_id').on(t.queueEntryId),
]);

export const scoreEvents = pgTable('score_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  queueEntryId: uuid('queue_entry_id').notNull().references(() => queueEntries.id, { onDelete: 'restrict' }),
  team: gameTeam('team').notNull(),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_score_events_game_id').on(t.gameId),
  index('idx_score_events_queue_entry_id').on(t.queueEntryId),
  index('idx_score_events_game_voided').on(t.gameId).where(sql`voided_at IS NULL`),
]);
