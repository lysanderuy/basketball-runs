import { NextRequest, NextResponse } from "next/server";

// GET /api/runs/[code]/games/[gameId] — fetch a single game with players and score events
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; gameId: string }> },
) {
  void req;
  void params;
  return NextResponse.json({});
}
