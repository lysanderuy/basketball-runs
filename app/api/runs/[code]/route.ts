import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runs, runPlayers } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const run = await db.query.runs.findFirst({
    where: eq(runs.code, code),
    with: {
      players: {
        orderBy: asc(runPlayers.position),
      },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({ run });
}
