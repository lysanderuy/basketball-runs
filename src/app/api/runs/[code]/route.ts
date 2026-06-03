import { NextResponse } from "next/server";

// GET /api/runs/[code] — fetch run by session code
export async function GET(): Promise<Response> {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
