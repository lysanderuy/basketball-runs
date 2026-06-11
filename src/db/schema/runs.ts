import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";
import { runFormat, runPointSystem, runStatus } from "./enums";

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
