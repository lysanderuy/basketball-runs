import { NextRequest, NextResponse } from "next/server";
import { getRunByCode, getGameWithDetails, endGame } from "@/services/runs";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string; gameId: string }> },
): Promise<Response> {
  const { code, gameId } = await params;
  const run = await getRunByCode(code);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const details = await getGameWithDetails(gameId);
  if (!details || details.game.runId !== run.id) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json(details);
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string; gameId: string }> },
): Promise<Response> {
  const { code, gameId } = await params;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const run = await getRunByCode(code);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  if (run.hostId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const game = await endGame(gameId);
    return NextResponse.json(game);
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
