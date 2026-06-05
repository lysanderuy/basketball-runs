import { NextResponse } from "next/server";

// PATCH /api/runs/[code]/queue/[entryId] — update entry status or position
export async function PATCH(): Promise<Response> {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
