import { NextRequest, NextResponse } from "next/server";
import { getRunByCode, getGameWithBreakdown } from "@/services/runs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string; gameId: string }> },
): Promise<Response> {
  const { code, gameId } = await params;

  const run = await getRunByCode(code);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const data = await getGameWithBreakdown(gameId);
  if (!data || data.game.runId !== run.id) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...data.game,
    teamA: data.teamA,
    teamB: data.teamB,
  });
}
