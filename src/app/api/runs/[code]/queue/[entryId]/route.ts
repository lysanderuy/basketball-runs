import { NextRequest, NextResponse } from "next/server";

// PATCH /api/runs/[code]/queue/[entryId] — update entry status or position
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; entryId: string }> },
) {
  void req;
  void params;
  return NextResponse.json({});
}
