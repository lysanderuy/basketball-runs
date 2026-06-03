import { NextResponse } from "next/server";

// PATCH /api/runs/[code]/games/[gameId]/clock — start, pause, or resume clock
export async function PATCH(): Promise<Response> {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
