import { db } from "@/lib/db";
import { runs, games, gamePlayers, queueEntries, scoreEvents } from "@/lib/db/schema";
import { eq, count, desc, inArray, and, or, sql, isNull } from "drizzle-orm";
import type { CreateRunInput } from "@/lib/validations";
import type { Run, Game, ScoreEvent } from "@/types/db";

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

export class OngoingGameError extends Error {
  constructor() {
    super("A game is already in progress for this run");
    this.name = "OngoingGameError";
  }
}

// Thrown when a gameId does not exist or does not belong to the target run.
// The route catches this and returns 404 so a host cannot act on a game in a
// run they do not own (the URL only carries the run code, not the game's run).
export class GameNotFoundError extends Error {
  constructor() {
    super("Game not found");
    this.name = "GameNotFoundError";
  }
}

// Thrown when a score is attributed to a queue entry that is not a player on
// the named team of this game. The FK only enforces queue_entry_id existence,
// not game roster membership, so without this check a point could be credited
// to a benched player, a player from another game, or the wrong team.
export class PlayerNotInGameError extends Error {
  constructor() {
    super("Player is not on this team in this game");
    this.name = "PlayerNotInGameError";
  }
}

// Thrown when an identical score event (same game, player, team, points) was
// already recorded within SCORE_DEDUP_MS. Replaces the old in-memory rate
// limiter, which did not hold on serverless (per-instance Map). This check runs
// inside the FOR UPDATE transaction, so the second submit blocks on the first's
// row lock and reliably sees it — a true cross-instance guard against double-taps.
export class DuplicateScoreError extends Error {
  constructor() {
    super("Duplicate score — ignored");
    this.name = "DuplicateScoreError";
  }
}

// Window for treating an identical score event as an accidental duplicate. Short
// enough that no human can legitimately register two identical baskets for the
// same player this fast.
const SCORE_DEDUP_MS = 600;

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

    const [ongoing] = await tx
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.runId, runId), or(eq(games.status, "pending"), eq(games.status, "active"))))
      .limit(1);
    if (ongoing) throw new OngoingGameError();

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

export async function closeRun(runId: string): Promise<Run> {
  const [updated] = await db
    .update(runs)
    .set({ status: "completed" })
    .where(eq(runs.id, runId))
    .returning();
  if (!updated) throw new Error("Run not found");
  return updated;
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

// ─── Game detail types ────────────────────────────────────────────────────────

export type PlayerWithStats = {
  queueEntryId: string;
  displayName: string;
  team: "team_a" | "team_b";
  points: number;
};

export type ScoreEventEntry = {
  id: string;
  queueEntryId: string;
  displayName: string;
  team: "team_a" | "team_b";
  points: number;
  createdAt: string;
};

export type GameWithDetails = {
  game: Game;
  players: PlayerWithStats[];
  recentEvents: ScoreEventEntry[];
};

// ─── Game detail query ────────────────────────────────────────────────────────

export async function getGameWithDetails(gameId: string): Promise<GameWithDetails | null> {
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) return null;

  const [playerRows, recentRows] = await Promise.all([
    db
      .select({
        queueEntryId: gamePlayers.queueEntryId,
        displayName: queueEntries.displayName,
        team: gamePlayers.team,
        points: sql<number>`COALESCE(SUM(${scoreEvents.points}), 0)`,
      })
      .from(gamePlayers)
      .innerJoin(queueEntries, eq(queueEntries.id, gamePlayers.queueEntryId))
      .leftJoin(
        scoreEvents,
        and(
          eq(scoreEvents.queueEntryId, gamePlayers.queueEntryId),
          eq(scoreEvents.gameId, gameId),
          isNull(scoreEvents.voidedAt),
        ),
      )
      .where(eq(gamePlayers.gameId, gameId))
      .groupBy(gamePlayers.queueEntryId, queueEntries.displayName, gamePlayers.team),

    db
      .select({
        id: scoreEvents.id,
        queueEntryId: scoreEvents.queueEntryId,
        displayName: queueEntries.displayName,
        team: scoreEvents.team,
        points: scoreEvents.points,
        createdAt: scoreEvents.createdAt,
      })
      .from(scoreEvents)
      .innerJoin(queueEntries, eq(queueEntries.id, scoreEvents.queueEntryId))
      .where(and(eq(scoreEvents.gameId, gameId), isNull(scoreEvents.voidedAt)))
      .orderBy(desc(scoreEvents.createdAt))
      .limit(10),
  ]);

  return {
    game,
    players: playerRows.map((r) => ({
      queueEntryId: r.queueEntryId,
      displayName: r.displayName,
      team: r.team,
      points: Number(r.points),
    })),
    recentEvents: recentRows.map((r) => ({
      id: r.id,
      queueEntryId: r.queueEntryId,
      displayName: r.displayName,
      team: r.team,
      points: r.points,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export async function recordScore(
  gameId: string,
  runId: string,
  queueEntryId: string,
  team: "team_a" | "team_b",
  points: number,
): Promise<ScoreEvent> {
  return db.transaction(async (tx) => {
    // Row lock so a concurrent endGame (which also locks this row) cannot close
    // the game between our status check and the score insert — serializes the
    // read-check-insert against game completion.
    const [game] = await tx
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1)
      .for("update");
    if (!game || game.runId !== runId) throw new GameNotFoundError();
    if (game.status === "completed") throw new Error("Game is already completed");

    // Verify the queue entry is actually a player on this team in this game.
    const [member] = await tx
      .select({ id: gamePlayers.id })
      .from(gamePlayers)
      .where(
        and(
          eq(gamePlayers.gameId, gameId),
          eq(gamePlayers.queueEntryId, queueEntryId),
          eq(gamePlayers.team, team),
        ),
      )
      .limit(1);
    if (!member) throw new PlayerNotInGameError();

    // Dedup guard — reject an identical score event landing within the window.
    // Safe because the FOR UPDATE lock above serializes scores for this game, so
    // a rapid second submit waits for the first to commit and then sees it here.
    const [recent] = await tx
      .select({ id: scoreEvents.id })
      .from(scoreEvents)
      .where(
        and(
          eq(scoreEvents.gameId, gameId),
          eq(scoreEvents.queueEntryId, queueEntryId),
          eq(scoreEvents.team, team),
          eq(scoreEvents.points, points),
          isNull(scoreEvents.voidedAt),
          sql`${scoreEvents.createdAt} >= NOW() - (${SCORE_DEDUP_MS} || ' milliseconds')::interval`,
        ),
      )
      .limit(1);
    if (recent) throw new DuplicateScoreError();

    if (game.status === "pending") {
      await tx
        .update(games)
        .set({ status: "active", startedAt: new Date() })
        .where(eq(games.id, gameId));
    }

    const [event] = await tx
      .insert(scoreEvents)
      .values({ gameId, queueEntryId, team, points })
      .returning();

    // Re-read to get trigger-updated scores and auto-complete if goal reached
    const [updated] = await tx.select().from(games).where(eq(games.id, gameId)).limit(1);
    if (updated.scoreA >= updated.scoreGoal || updated.scoreB >= updated.scoreGoal) {
      let winner: "team_a" | "team_b" | "tie";
      if (updated.scoreA > updated.scoreB) winner = "team_a";
      else if (updated.scoreB > updated.scoreA) winner = "team_b";
      else winner = "tie";
      await tx
        .update(games)
        .set({
          status: "completed",
          winner,
          endedAt: new Date(),
          ...(updated.clockStartedAt && !updated.clockPausedAt ? { clockPausedAt: new Date() } : {}),
        })
        .where(eq(games.id, gameId));
      // Queue rotation is handled by the trg_rotate_queue_on_game_complete
      // trigger that fires on this status → 'completed' transition.
    }

    return event;
  });
}

export async function undoLastScore(gameId: string, runId: string): Promise<ScoreEvent | null> {
  const [game] = await db
    .select({ runId: games.runId })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  if (!game || game.runId !== runId) throw new GameNotFoundError();

  const [event] = await db
    .select()
    .from(scoreEvents)
    .where(and(eq(scoreEvents.gameId, gameId), isNull(scoreEvents.voidedAt)))
    .orderBy(desc(scoreEvents.createdAt))
    .limit(1);

  if (!event) return null;

  const [updated] = await db
    .update(scoreEvents)
    .set({ voidedAt: new Date() })
    .where(eq(scoreEvents.id, event.id))
    .returning();

  return updated;
}

// ─── Clock ────────────────────────────────────────────────────────────────────

export async function clockAction(
  gameId: string,
  runId: string,
  action: "start" | "pause" | "resume",
): Promise<Game> {
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game || game.runId !== runId) throw new GameNotFoundError();

  const now = new Date();

  if (action === "start") {
    const [updated] = await db
      .update(games)
      .set({ clockStartedAt: now, status: "active", startedAt: game.startedAt ?? now })
      .where(eq(games.id, gameId))
      .returning();
    return updated;
  }

  if (action === "pause") {
    const [updated] = await db
      .update(games)
      .set({ clockPausedAt: now })
      .where(eq(games.id, gameId))
      .returning();
    return updated;
  }

  // resume
  const pausedMs = game.clockPausedAt ? now.getTime() - game.clockPausedAt.getTime() : 0;
  const [updated] = await db
    .update(games)
    .set({
      clockPausedAt: null,
      totalPausedSeconds: game.totalPausedSeconds + Math.floor(pausedMs / 1000),
    })
    .where(eq(games.id, gameId))
    .returning();
  return updated;
}

// ─── End game ─────────────────────────────────────────────────────────────────

export async function endGame(gameId: string, runId: string): Promise<Game> {
  return db.transaction(async (tx) => {
    // Row lock on the game so a concurrent recordScore (whose trigger takes
    // the same row lock) blocks until we commit, and its updates are visible
    // in our subsequent read.
    const [game] = await tx
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1)
      .for("update");
    if (!game || game.runId !== runId) throw new GameNotFoundError();
    if (game.status === "completed") return game;

    // Per-run advisory lock — same key as createGame — so a concurrent
    // createGame for the same run queues behind us and cannot insert a new
    // game row for a run we are about to close.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${game.runId}))`);

    const now = new Date();
    let winner: "team_a" | "team_b" | "tie";
    if (game.scoreA > game.scoreB) winner = "team_a";
    else if (game.scoreB > game.scoreA) winner = "team_b";
    else winner = "tie";

    const [updated] = await tx
      .update(games)
      .set({
        status: "completed",
        winner,
        endedAt: now,
        ...(game.clockStartedAt && !game.clockPausedAt ? { clockPausedAt: now } : {}),
      })
      .where(eq(games.id, gameId))
      .returning();
    // Queue rotation is handled by the trg_rotate_queue_on_game_complete
    // trigger that fires on this status → 'completed' transition.

    return updated;
  });
}
