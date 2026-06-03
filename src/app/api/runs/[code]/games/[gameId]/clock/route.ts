import { NextRequest, NextResponse } from "next/server";

// PATCH /api/runs/[code]/games/[gameId]/clock — start, pause, or resume clock
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; gameId: string }> },
) {
  void req;
  void params;
  return NextResponse.json({});
}
