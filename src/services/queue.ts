import { db } from "@/lib/db";
import { queueEntries } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";

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

  return entry;
}
