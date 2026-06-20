import { db } from "@/db";
import { runs, games, gamePlayers, queueEntries, scoreEvents } from "@/db/schema";
import { eq, desc, inArray, and, or, sql, isNull } from "drizzle-orm";
import { RunNotFoundError } from "@/services/run.service";
import type { Game, ScoreEvent } from "@/types/db";

// Thrown when submitted queue entry IDs do not belong to the target run.
// The route catches this and returns 400 rather than letting it bubble as 500.
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

// Thrown when a mutation targets a game that has already completed. Maps to
// 409 — completed games are immutable (no scores, undos, or clock actions).
export class GameCompletedError extends Error {
  constructor() {
    super("Game is already completed");
    this.name = "GameCompletedError";
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

// Thrown when a score event is submitted with a point value that does not
// belong to the run's point system (e.g. 3 on a 1-2 run, or 1 on a 2-3 run).
// The route resolves the allowed set from run.pointSystem and passes it in;
// this check rejects before any DB work so we don't acquire a FOR UPDATE lock
// on input the database would silently accept.
export class InvalidPointsError extends Error {
  constructor() {
    super("Invalid points for this run's point system");
    this.name = "InvalidPointsError";
  }
}

// Window for treating an identical score event as an accidental duplicate. Short
// enough that no human can legitimately register two identical baskets for the
// same player this fast.
const SCORE_DEDUP_MS = 600;

export async function getGamesByRunId(runId: string): Promise<Game[]> {
  return db
    .select()
    .from(games)
    .where(eq(games.runId, runId))
    .orderBy(desc(games.gameNumber));
}

// One entry per completed game in the run: the single top scorer (or null if
// nobody scored). Used to render the compact "Top: <name> — N pts" line on
// each past-game card on the feed, in a single round trip instead of N+1
// game-detail fetches. Tie-break by displayName ASC for a stable order — the
// feed card surfaces one name, not all tied players.
export type GameTopScorer = {
  gameId: string;
  topScorer: { queueEntryId: string; displayName: string; points: number } | null;
};

export async function getTopScorersByRunId(runId: string): Promise<GameTopScorer[]> {
  const rows = await db
    .select({
      gameId: gamePlayers.gameId,
      queueEntryId: gamePlayers.queueEntryId,
      displayName: queueEntries.displayName,
      points: sql<number>`COALESCE(SUM(${scoreEvents.points}), 0)`,
    })
    .from(gamePlayers)
    .innerJoin(queueEntries, eq(queueEntries.id, gamePlayers.queueEntryId))
    .leftJoin(
      scoreEvents,
      and(
        eq(scoreEvents.queueEntryId, gamePlayers.queueEntryId),
        eq(scoreEvents.gameId, gamePlayers.gameId),
        isNull(scoreEvents.voidedAt),
      ),
    )
    .innerJoin(games, eq(games.id, gamePlayers.gameId))
    .where(and(eq(games.runId, runId), eq(games.status, "completed")))
    .groupBy(gamePlayers.gameId, gamePlayers.queueEntryId, queueEntries.displayName)
    .orderBy(
      gamePlayers.gameId,
      desc(sql`COALESCE(SUM(${scoreEvents.points}), 0)`),
      queueEntries.displayName,
    );

  const byGame = new Map<string, GameTopScorer>();
  for (const r of rows) {
    const existing = byGame.get(r.gameId);
    const points = Number(r.points);
    if (!existing) {
      byGame.set(r.gameId, {
        gameId: r.gameId,
        topScorer:
          points > 0
            ? { queueEntryId: r.queueEntryId, displayName: r.displayName, points }
            : null,
      });
    }
  }
  return Array.from(byGame.values());
}

export async function createGame(
  runId: string,
  teamAEntryIds: string[],
  teamBEntryIds: string[],
): Promise<Game> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) throw new RunNotFoundError();

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
      .groupBy(gamePlayers.queueEntryId, queueEntries.displayName, gamePlayers.team)
      // Sort at the SQL layer so the leader is always first. Tie-break by
      // displayName ASC for a stable order when two players finish on the
      // same points total.
      .orderBy(
        desc(sql`COALESCE(SUM(${scoreEvents.points}), 0)`),
        queueEntries.displayName,
      ),

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
  allowedPoints: number[],
): Promise<ScoreEvent> {
  if (!allowedPoints.includes(points)) throw new InvalidPointsError();
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
    if (game.status === "completed") throw new GameCompletedError();

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
  return db.transaction(async (tx) => {
    // Row lock so a concurrent recordScore/endGame (which lock the same row)
    // serializes against the void, and two rapid undos cannot both read the
    // same "last" event. Also blocks voiding after the game is completed,
    // which would change the score without re-evaluating winner or rotation.
    const [game] = await tx
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1)
      .for("update");
    if (!game || game.runId !== runId) throw new GameNotFoundError();
    if (game.status === "completed") throw new GameCompletedError();

    const [event] = await tx
      .select()
      .from(scoreEvents)
      .where(and(eq(scoreEvents.gameId, gameId), isNull(scoreEvents.voidedAt)))
      .orderBy(desc(scoreEvents.createdAt))
      .limit(1);

    if (!event) return null;

    const [updated] = await tx
      .update(scoreEvents)
      .set({ voidedAt: new Date() })
      .where(eq(scoreEvents.id, event.id))
      .returning();

    return updated;
  });
}

// ─── Clock ────────────────────────────────────────────────────────────────────

export async function clockAction(
  gameId: string,
  runId: string,
  action: "start" | "pause" | "resume",
): Promise<Game> {
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game || game.runId !== runId) throw new GameNotFoundError();
  if (game.status === "completed") throw new GameCompletedError();

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
    // Idempotent — re-pausing an already-paused clock must not move
    // clockPausedAt forward, which would erase paused time already accrued and
    // let the clock run ahead of reality on the next resume.
    if (game.clockPausedAt) return game;
    const [updated] = await db
      .update(games)
      .set({ clockPausedAt: now })
      .where(eq(games.id, gameId))
      .returning();
    return updated;
  }

  // resume — idempotent: a resume on a clock that is not paused is a no-op.
  if (!game.clockPausedAt) return game;
  const pausedMs = now.getTime() - game.clockPausedAt.getTime();
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
