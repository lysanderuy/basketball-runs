import { pgTable, uuid, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { runs } from "./runs";
import { gameStatus, gameWinner } from "./enums";

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
