import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runs, runPlayers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { name } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const [run] = await db
    .select({ id: runs.id })
    .from(runs)
    .where(eq(runs.code, code))
    .limit(1);

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const [last] = await db
    .select({ position: runPlayers.position })
    .from(runPlayers)
    .where(eq(runPlayers.runId, run.id))
    .orderBy(desc(runPlayers.position))
    .limit(1);

  const [player] = await db
    .insert(runPlayers)
    .values({
      runId: run.id,
      name: name.trim(),
      section: "waiting",
      position: last ? last.position + 1 : 0,
    })
    .returning();

  return NextResponse.json({ player }, { status: 201 });
}
