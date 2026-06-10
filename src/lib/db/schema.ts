import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const runPointSystem = pgEnum("run_point_system", ["one_two", "two_three"]);

export const runFormat = pgEnum("run_format", [
  "winner_stays",
  "new_ten",
  "host_decides",
]);

export const runStatus = pgEnum("run_status", [
  "lobby",
  "active",
  "completed",
]);

export const gameStatus = pgEnum("game_status", [
  "pending",
  "active",
  "completed",
]);

export const gameTeam = pgEnum("game_team", ["team_a", "team_b"]);

export const gameWinner = pgEnum("game_winner", ["team_a", "team_b", "tie"]);

export const queueEntryStatus = pgEnum("queue_entry_status", [
  "waiting",
  "marked_out",
  "removed",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    // Mirrors auth.users(id) — FK to auth.users is set via SQL migration, not here
    id: uuid("id").primaryKey(),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_users_created_at").on(t.createdAt),
  ],
);

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostId: uuid("host_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    location: text("location"),
    format: runFormat("format").notNull(),
    scoreGoal: integer("score_goal").notNull().default(21),
    pointSystem: runPointSystem("point_system").notNull().default("two_three"),
    timeLimitSeconds: integer("time_limit_seconds"),
    status: runStatus("status").notNull().default("lobby"),
    sessionCode: text("session_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_runs_session_code").on(t.sessionCode),
    index("idx_runs_host_id").on(t.hostId),
    index("idx_runs_status").on(t.status),
  ],
);

export const queueEntries = pgTable(
  "queue_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
    // Nullable — guests have no account
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    status: queueEntryStatus("status").notNull().default("waiting"),
    // Integer position for queue ordering — lower = front of queue
    position: integer("position").notNull().default(0),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_queue_entries_run_id").on(t.runId),
    index("idx_queue_entries_user_id").on(t.userId),
    index("idx_queue_entries_run_id_position").on(t.runId, t.position),
  ],
);

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
    gameNumber: integer("game_number").notNull(),
    status: gameStatus("status").notNull().default("pending"),
    scoreGoal: integer("score_goal").notNull(),
    // NULL = no clock
    timeLimitSeconds: integer("time_limit_seconds"),
    clockStartedAt: timestamp("clock_started_at", { withTimezone: true }),
    // Non-null = clock is currently paused
    clockPausedAt: timestamp("clock_paused_at", { withTimezone: true }),
    totalPausedSeconds: integer("total_paused_seconds").notNull().default(0),
    // Trigger-maintained — never written by the app directly
    scoreA: integer("score_a").notNull().default(0),
    scoreB: integer("score_b").notNull().default(0),
    winner: gameWinner("winner"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_games_run_id_game_number").on(t.runId, t.gameNumber),
    index("idx_games_run_id").on(t.runId),
    index("idx_games_status").on(t.status),
  ],
);

export const gamePlayers = pgTable(
  "game_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    // RESTRICT — a queue entry with game history cannot be hard-deleted
    queueEntryId: uuid("queue_entry_id").notNull().references(() => queueEntries.id, { onDelete: "restrict" }),
    team: gameTeam("team").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // No updatedAt — immutable after creation
  },
  (t) => [
    uniqueIndex("uq_game_players_game_entry").on(t.gameId, t.queueEntryId),
    index("idx_game_players_game_id").on(t.gameId),
    index("idx_game_players_queue_entry_id").on(t.queueEntryId),
  ],
);

export const scoreEvents = pgTable(
  "score_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    // RESTRICT — scoring history is permanent
    queueEntryId: uuid("queue_entry_id").notNull().references(() => queueEntries.id, { onDelete: "restrict" }),
    team: gameTeam("team").notNull(),
    points: integer("points").notNull().default(1),
    // NULL = active point, non-null = undone
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // No updatedAt — rows are never updated except voidedAt via trigger
  },
  (t) => [
    index("idx_score_events_game_id").on(t.gameId),
    index("idx_score_events_queue_entry_id").on(t.queueEntryId),
    // Partial index — covers all live score queries (active events only)
    index("idx_score_events_game_voided").on(t.gameId).where(sql`voided_at IS NULL`),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  runs: many(runs),
  queueEntries: many(queueEntries),
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
  host: one(users, { fields: [runs.hostId], references: [users.id] }),
  queueEntries: many(queueEntries),
  games: many(games),
}));

export const queueEntriesRelations = relations(queueEntries, ({ one, many }) => ({
  run: one(runs, { fields: [queueEntries.runId], references: [runs.id] }),
  user: one(users, { fields: [queueEntries.userId], references: [users.id] }),
  gamePlayers: many(gamePlayers),
  scoreEvents: many(scoreEvents),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  run: one(runs, { fields: [games.runId], references: [runs.id] }),
  gamePlayers: many(gamePlayers),
  scoreEvents: many(scoreEvents),
}));

export const gamePlayersRelations = relations(gamePlayers, ({ one }) => ({
  game: one(games, { fields: [gamePlayers.gameId], references: [games.id] }),
  queueEntry: one(queueEntries, {
    fields: [gamePlayers.queueEntryId],
    references: [queueEntries.id],
  }),
}));

export const scoreEventsRelations = relations(scoreEvents, ({ one }) => ({
  game: one(games, { fields: [scoreEvents.gameId], references: [games.id] }),
  queueEntry: one(queueEntries, {
    fields: [scoreEvents.queueEntryId],
    references: [queueEntries.id],
  }),
}));
