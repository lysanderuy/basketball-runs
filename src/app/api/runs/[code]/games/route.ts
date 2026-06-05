import { NextRequest, NextResponse } from "next/server";
import { getRunByCode, getGamesByRunId } from "@/services/runs";

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
  const games = await getGamesByRunId(run.id);
  return NextResponse.json(games);
}

export async function POST(): Promise<Response> {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
