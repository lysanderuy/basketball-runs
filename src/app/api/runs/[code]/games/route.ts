import { NextRequest, NextResponse } from "next/server";

// GET  /api/runs/[code]/games — fetch all games for a run
// POST /api/runs/[code]/games — create a new game with team assignment
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  void req;
  void params;
  return NextResponse.json({});
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  void req;
  void params;
  return NextResponse.json({});
}
