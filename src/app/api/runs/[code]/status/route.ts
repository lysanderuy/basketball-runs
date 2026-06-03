import { NextRequest, NextResponse } from "next/server";

// PATCH /api/runs/[code]/status — update run status (lobby → active → completed)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  void req;
  void params;
  return NextResponse.json({});
}
