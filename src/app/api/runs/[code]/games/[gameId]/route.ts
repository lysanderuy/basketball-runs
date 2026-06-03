import { NextResponse } from "next/server";

// GET /api/runs/[code]/games/[gameId] — fetch a single game with players and score events
export async function GET(): Promise<Response> {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
