import { db } from "@/lib/db";
import { queueEntries, games, gamePlayers } from "@/lib/db/schema";
import { eq, and, ne, sql, inArray, asc } from "drizzle-orm";
import type { QueueEntry } from "@/types/db";

export async function joinQueue(
  runId: string,
  displayName: string,
  userId?: string | null,
) {
  return db.transaction(async (tx) => {
    // Per-run advisory lock (two-int4 space — distinct from the game-creation lock)
    // Serializes concurrent joins so two callers can't both read the same max position
    // and produce a duplicate.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${runId}), 2)`);

    const [{ maxPos }] = await tx
      .select({ maxPos: sql<number>`COALESCE(MAX(${queueEntries.position}), 0)` })
      .from(queueEntries)
      .where(eq(queueEntries.runId, runId));

    const newPosition = (maxPos ?? 0) + 1;

    const [entry] = await tx
      .insert(queueEntries)
      .values({ runId, userId: userId ?? null, displayName, position: newPosition })
      .returning();

    return { entry, position: newPosition };
  });
}

export async function getQueueForRun(
  runId: string,
): Promise<{ onCourt: QueueEntry[]; waiting: QueueEntry[] }> {
  const [allEntries, activeGame] = await Promise.all([
    db
      .select()
      .from(queueEntries)
      .where(and(eq(queueEntries.runId, runId), ne(queueEntries.status, "removed")))
      .orderBy(asc(queueEntries.position)),
    db
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.runId, runId), eq(games.status, "active")))
      .limit(1),
  ]);

  let onCourtIds = new Set<string>();
  if (activeGame.length > 0) {
    const players = await db
      .select({ queueEntryId: gamePlayers.queueEntryId })
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, activeGame[0].id));
    onCourtIds = new Set(players.map((p) => p.queueEntryId));
  }

  // Compute actual games played from completed games (denormalized column is stale)
  const entryIds = allEntries.map((e) => e.id);
  const gamesPlayedMap = new Map<string, number>();
  if (entryIds.length > 0) {
    const counts = await db
      .select({
        queueEntryId: gamePlayers.queueEntryId,
        count: sql<number>`COUNT(*)`,
      })
      .from(gamePlayers)
      .innerJoin(games, eq(games.id, gamePlayers.gameId))
      .where(
        and(
          inArray(gamePlayers.queueEntryId, entryIds),
          eq(games.status, "completed"),
        ),
      )
      .groupBy(gamePlayers.queueEntryId);

    for (const row of counts) {
      gamesPlayedMap.set(row.queueEntryId, Number(row.count));
    }
  }

  for (const entry of allEntries) {
    entry.gamesPlayed = gamesPlayedMap.get(entry.id) ?? 0;
  }

  const onCourt = allEntries.filter((e) => onCourtIds.has(e.id));
  const waiting = allEntries.filter((e) => !onCourtIds.has(e.id));

  return { onCourt, waiting };
}

export async function updateQueueEntryStatus(
  entryId: string,
  status: "waiting" | "marked_out" | "removed",
): Promise<QueueEntry | null> {
  const [entry] = await db
    .update(queueEntries)
    .set({ status, updatedAt: new Date() })
    .where(eq(queueEntries.id, entryId))
    .returning();
  return entry ?? null;
}

export async function updateQueueEntrySittingOut(
  entryId: string,
  sittingOut: boolean,
): Promise<QueueEntry | null> {
  const [entry] = await db
    .update(queueEntries)
    .set({ sittingOut, updatedAt: new Date() })
    .where(eq(queueEntries.id, entryId))
    .returning();
  return entry ?? null;
}
