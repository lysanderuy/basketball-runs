import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getRunByCode(code: string) {
  const [run] = await db
    .select()
    .from(runs)
    .where(eq(runs.sessionCode, code))
    .limit(1);
  return run ?? null;
}
