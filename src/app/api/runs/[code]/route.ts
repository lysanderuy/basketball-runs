import { NextRequest, NextResponse } from "next/server";

// GET /api/runs/[code] — fetch run by session code
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  void req;
  void params;
  return NextResponse.json({});
}
