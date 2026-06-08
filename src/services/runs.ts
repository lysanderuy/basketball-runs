import { db } from "@/lib/db";
import { runs, games, gamePlayers, queueEntries } from "@/lib/db/schema";
import { eq, count, desc, inArray, and, or, sql } from "drizzle-orm";
import type { CreateRunInput } from "@/lib/validations";
import type { Run, Game } from "@/types/db";

export async function getRunByCode(code: string) {
  const [run] = await db
    .select()
    .from(runs)
    .where(eq(runs.sessionCode, code))
    .limit(1);
  return run ?? null;
}

export async function getRunsByHostId(hostId: string) {
  return db
    .select({
      id: runs.id,
      name: runs.name,
      location: runs.location,
      status: runs.status,
      sessionCode: runs.sessionCode,
      createdAt: runs.createdAt,
      gameCount: count(games.id),
    })
    .from(runs)
    .leftJoin(games, eq(games.runId, runs.id))
    .where(eq(runs.hostId, hostId))
    .groupBy(runs.id)
    .orderBy(desc(runs.createdAt));
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

export async function getGamesByRunId(runId: string): Promise<Game[]> {
  return db
    .select()
    .from(games)
    .where(eq(games.runId, runId))
    .orderBy(desc(games.gameNumber));
}

// Thrown when submitted queue entry IDs do not belong to the target run.
// The route catches this and returns 422 rather than letting it bubble as 500.
export class InvalidEntryIdsError extends Error {
  constructor() {
    super("One or more queue entry IDs do not belong to this run");
    this.name = "InvalidEntryIdsError";
  }
}

export async function createGame(
  runId: string,
  teamAEntryIds: string[],
  teamBEntryIds: string[],
): Promise<Game> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) throw new Error("Run not found");

  // Verify all submitted entry IDs actually belong to this run before acquiring
  // any locks. The FK only enforces queue_entry_id → queue_entries.id, not run
  // membership, so a caller could otherwise cross-contaminate entries from a
  // different run.
  const allEntryIds = [...new Set([...teamAEntryIds, ...teamBEntryIds])];
  if (allEntryIds.length > 0) {
    const valid = await db
      .select({ id: queueEntries.id })
      .from(queueEntries)
      .where(and(inArray(queueEntries.id, allEntryIds), eq(queueEntries.runId, runId)));
    if (valid.length !== allEntryIds.length) throw new InvalidEntryIdsError();
  }

  return db.transaction(async (tx) => {
    // Acquire a per-run advisory lock so concurrent game creation calls for the
    // same run queue behind each other rather than reading the same MAX and
    // colliding on the uq_games_run_id_game_number constraint.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${runId}))`);

    const [{ maxNum }] = await tx
      .select({ maxNum: sql<number>`COALESCE(MAX(${games.gameNumber}), 0)` })
      .from(games)
      .where(eq(games.runId, runId));

    const [game] = await tx
      .insert(games)
      .values({
        runId,
        gameNumber: (maxNum ?? 0) + 1,
        scoreGoal: run.scoreGoal,
        timeLimitSeconds: run.timeLimitSeconds,
      })
      .returning();

    const allPlayers = [
      ...teamAEntryIds.map((id) => ({ gameId: game.id, queueEntryId: id, team: "team_a" as const })),
      ...teamBEntryIds.map((id) => ({ gameId: game.id, queueEntryId: id, team: "team_b" as const })),
    ];

    if (allPlayers.length > 0) {
      await tx.insert(gamePlayers).values(allPlayers);
    }

    return game;
  });
}

export async function createRun(
  input: CreateRunInput & { hostId: string }
): Promise<Run> {
  const { hostId, name, location, format, sessionCode, scoreGoal, timeLimitSeconds } = input;
  const [run] = await db
    .insert(runs)
    .values({ hostId, name, location, format, sessionCode, scoreGoal, timeLimitSeconds })
    .returning();
  return run;
}
