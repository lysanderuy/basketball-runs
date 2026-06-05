import { NextResponse } from "next/server";

// PATCH /api/runs/[code]/status — update run status (lobby → active → completed)
export async function PATCH(): Promise<Response> {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
