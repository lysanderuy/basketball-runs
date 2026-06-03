import { NextResponse } from "next/server";

// GET  /api/runs/[code]/queue — fetch all queue entries
// POST /api/runs/[code]/queue — join queue (guest or authenticated)
export async function GET(): Promise<Response> {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}

export async function POST(): Promise<Response> {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
