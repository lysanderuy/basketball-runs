import { NextRequest, NextResponse } from "next/server";
import { getRunByCode, getGamesByRunId, createGame, InvalidEntryIdsError } from "@/services/runs";
import { createGameSchema } from "@/lib/validations";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const run = await getRunByCode(code);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  const games = await getGamesByRunId(run.id);
  return NextResponse.json(games);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await params;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await getRunByCode(code);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (run.hostId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = createGameSchema.safeParse(await req.json());
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  try {
    const game = await createGame(run.id, result.data.teamA, result.data.teamB);
    return NextResponse.json(game, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidEntryIdsError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
