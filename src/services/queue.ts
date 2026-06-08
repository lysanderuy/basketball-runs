import { db } from "@/lib/db";
import { queueEntries, games, gamePlayers } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import type { QueueEntry } from "@/types/db";

export async function joinQueue(
  runId: string,
  displayName: string,
  userId?: string | null
) {
  const activeEntries = await db
    .select({ id: queueEntries.id, afterEntryId: queueEntries.afterEntryId })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.runId, runId),
        ne(queueEntries.status, "removed")
      )
    );

  // Find the tail: entry whose ID is not referenced by any other entry's afterEntryId
  let tailId: string | null = null;
  if (activeEntries.length > 0) {
    const referenced = new Set(
      activeEntries
        .filter((e) => e.afterEntryId !== null)
        .map((e) => e.afterEntryId as string)
    );
    const tail = activeEntries.find((e) => !referenced.has(e.id));
    tailId = tail?.id ?? null;
  }

  const [entry] = await db
    .insert(queueEntries)
    .values({
      runId,
      userId: userId ?? null,
      displayName,
      afterEntryId: tailId,
    })
    .returning();

  return { entry, position: activeEntries.length + 1 };
}

export async function getQueueForRun(
  runId: string,
): Promise<{ onCourt: QueueEntry[]; waiting: QueueEntry[] }> {
  const [allEntries, activeGame] = await Promise.all([
    db
      .select()
      .from(queueEntries)
      .where(and(eq(queueEntries.runId, runId), ne(queueEntries.status, "removed"))),
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

  const nextMap = new Map(allEntries.map((e) => [e.afterEntryId, e]));

  let current = nextMap.get(null);
  const ordered: QueueEntry[] = [];
  const seen = new Set<string>();

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    ordered.push(current);
    current = nextMap.get(current.id);
  }

  for (const entry of allEntries) {
    if (!seen.has(entry.id)) {
      ordered.push(entry);
    }
  }

  const onCourt = ordered.filter((e) => onCourtIds.has(e.id));
  const waiting = ordered.filter((e) => !onCourtIds.has(e.id));

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
