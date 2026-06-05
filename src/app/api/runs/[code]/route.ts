import { NextRequest, NextResponse } from "next/server";
import { getRunByCode } from "@/services/runs";

// GET /api/runs/[code] — fetch run by session code
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  void req;
  const { code } = await params;
  const run = await getRunByCode(code);

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json(run);
}
