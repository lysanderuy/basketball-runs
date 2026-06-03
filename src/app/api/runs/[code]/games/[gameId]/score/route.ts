import { NextResponse } from "next/server";

// POST  /api/runs/[code]/games/[gameId]/score — record a point (inserts score_event)
// PATCH /api/runs/[code]/games/[gameId]/score — undo a point (sets voided_at)
export async function POST(): Promise<Response> {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}

export async function PATCH(): Promise<Response> {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
