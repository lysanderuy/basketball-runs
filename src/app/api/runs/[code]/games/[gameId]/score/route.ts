import { NextRequest, NextResponse } from "next/server";
import { getRunByCode, recordScore, undoLastScore, GameNotFoundError, DuplicateScoreError } from "@/services/runs";
import { scorePointSchema } from "@/lib/validations";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
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

  const result = scorePointSchema.safeParse(await req.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const allowedPoints = run.pointSystem === "one_two" ? [1, 2] : [2, 3];
  if (!allowedPoints.includes(result.data.points)) {
    return NextResponse.json(
      { error: `Invalid points for this run's point system (${run.pointSystem})` },
      { status: 400 },
    );
  }

  try {
    const event = await recordScore(gameId, run.id, result.data.queueEntryId, result.data.team, result.data.points);
    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    if (err instanceof GameNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof DuplicateScoreError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
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
    const event = await undoLastScore(gameId, run.id);
    if (!event) return NextResponse.json({ error: "No score to undo" }, { status: 422 });
    return NextResponse.json(event);
  } catch (err) {
    if (err instanceof GameNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
