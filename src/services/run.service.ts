import { db } from "@/db";
import { runs, games, queueEntries, scoreEvents } from "@/db/schema";
import { eq, count, desc, inArray, and, or, sql, isNull } from "drizzle-orm";
import type { CreateRunInput } from "@/validators";
import type { Run } from "@/types/db";

// Thrown when a runId resolved by the route no longer matches a run row.
// handleApiError maps this to 404 instead of leaking an internal message.
export class RunNotFoundError extends Error {
  constructor() {
    super("Run not found");
    this.name = "RunNotFoundError";
  }
}

export async function getRunByCode(code: string) {
  const [run] = await db
    .select()
    .from(runs)
    .where(eq(runs.sessionCode, code))
    .limit(1);
  return run ?? null;
}

export async function getRunsForUser(userId: string) {
  const joined = await db
    .selectDistinct({ runId: queueEntries.runId })
    .from(queueEntries)
    .where(eq(queueEntries.userId, userId));

  const joinedIds = joined.map((e) => e.runId);
  const condition =
    joinedIds.length > 0
      ? or(eq(runs.hostId, userId), inArray(runs.id, joinedIds))
      : eq(runs.hostId, userId);

  return db
    .select({
      id: runs.id,
      hostId: runs.hostId,
      name: runs.name,
      location: runs.location,
      status: runs.status,
      sessionCode: runs.sessionCode,
      createdAt: runs.createdAt,
      gameCount: count(games.id),
    })
    .from(runs)
    .leftJoin(games, eq(games.runId, runs.id))
    .where(condition)
    .groupBy(runs.id)
    .orderBy(desc(runs.createdAt));
}

export async function getActiveRunByHostId(hostId: string): Promise<Run | null> {
  const [run] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.hostId, hostId), inArray(runs.status, ["lobby", "active"])))
    .limit(1);
  return run ?? null;
}

export async function createRun(
  input: CreateRunInput & { hostId: string }
): Promise<Run> {
  const { hostId, name, location, format, sessionCode, scoreGoal, pointSystem, timeLimitSeconds } = input;
  const [run] = await db
    .insert(runs)
    .values({ hostId, name, location, format, sessionCode, scoreGoal, pointSystem, timeLimitSeconds })
    .returning();
  return run;
}

export async function closeRun(runId: string): Promise<Run> {
  const [updated] = await db
    .update(runs)
    .set({ status: "completed" })
    .where(eq(runs.id, runId))
    .returning();
  if (!updated) throw new RunNotFoundError();
  return updated;
}

// Run-level totals for the "Run ended" summary block. Read-only, scoped to
// one run. Only completed games count — the feature is "once a game ended"
// and the live game doesn't have a final score yet.
export type RunStats = {
  gameCount: number;
  totalPoints: number;
  topScorer: { displayName: string; points: number } | null;
};

export async function getRunStats(runId: string): Promise<RunStats> {
  const [totals] = await db
    .select({
      gameCount: count(games.id),
      totalPoints: sql<number>`COALESCE(SUM(${games.scoreA} + ${games.scoreB}), 0)`,
    })
    .from(games)
    .where(and(eq(games.runId, runId), eq(games.status, "completed")));

  // Top scorer across the run — sum score events per queue entry, scoped to
  // completed games in this run. Tie-break by displayName ASC for a stable
  // single leader when players finish on the same total.
  const [top] = await db
    .select({
      queueEntryId: scoreEvents.queueEntryId,
      displayName: queueEntries.displayName,
      points: sql<number>`COALESCE(SUM(${scoreEvents.points}), 0)`,
    })
    .from(scoreEvents)
    .innerJoin(queueEntries, eq(queueEntries.id, scoreEvents.queueEntryId))
    .innerJoin(games, eq(games.id, scoreEvents.gameId))
    .where(
      and(
        eq(games.runId, runId),
        eq(games.status, "completed"),
        isNull(scoreEvents.voidedAt),
      ),
    )
    .groupBy(scoreEvents.queueEntryId, queueEntries.displayName)
    .orderBy(
      desc(sql`COALESCE(SUM(${scoreEvents.points}), 0)`),
      queueEntries.displayName,
    )
    .limit(1);

  return {
    gameCount: Number(totals?.gameCount ?? 0),
    totalPoints: Number(totals?.totalPoints ?? 0),
    topScorer: top && Number(top.points) > 0
      ? { displayName: top.displayName, points: Number(top.points) }
      : null,
  };
}
