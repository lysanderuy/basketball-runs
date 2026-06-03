import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import type { CreateRunInput } from "@/lib/validations";
import type { Run } from "@/types/db";

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
