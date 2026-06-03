import { NextRequest, NextResponse } from "next/server";

// GET  /api/runs/[code]/queue — fetch all queue entries
// POST /api/runs/[code]/queue — join queue (guest or authenticated)
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
