import type {
  users,
  runs,
  queueEntries,
  games,
  gamePlayers,
  scoreEvents,
} from "@/lib/db/schema";

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;

export type QueueEntry = typeof queueEntries.$inferSelect;
export type NewQueueEntry = typeof queueEntries.$inferInsert;

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

export type GamePlayer = typeof gamePlayers.$inferSelect;
export type NewGamePlayer = typeof gamePlayers.$inferInsert;

export type ScoreEvent = typeof scoreEvents.$inferSelect;
export type NewScoreEvent = typeof scoreEvents.$inferInsert;
