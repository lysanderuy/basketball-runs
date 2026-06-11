import { db } from "@/db";
import { runs, games, queueEntries } from "@/db/schema";
import { eq, count, desc, inArray, and, or } from "drizzle-orm";
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
