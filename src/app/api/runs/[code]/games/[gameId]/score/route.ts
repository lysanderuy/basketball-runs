import { NextRequest, NextResponse } from "next/server";

// POST  /api/runs/[code]/games/[gameId]/score — record a point (inserts score_event)
// PATCH /api/runs/[code]/games/[gameId]/score — undo a point (sets voided_at)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; gameId: string }> },
) {
  void req;
  void params;
  return NextResponse.json({});
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; gameId: string }> },
) {
  void req;
  void params;
  return NextResponse.json({});
}
