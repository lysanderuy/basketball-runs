import { NextResponse } from "next/server";

// GET  /api/runs/[code]/games — fetch all games for a run
// POST /api/runs/[code]/games — create a new game with team assignment
export async function GET(): Promise<Response> {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}

export async function POST(): Promise<Response> {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
