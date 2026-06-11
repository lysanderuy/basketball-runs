import { NextRequest } from "next/server";
import { getRunByCode } from "@/services/run.service";
import { recordScore, undoLastScore } from "@/services/game.service";
import { scorePointSchema } from "@/validators";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; gameId: string }> },
): Promise<Response> {
  const { code, gameId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  if (!userId) return apiError("UNAUTHORIZED", "Unauthorized", 401);

  const run = await getRunByCode(code);
  if (!run) return apiError("NOT_FOUND", "Run not found", 404);
  if (run.hostId !== userId) return apiError("FORBIDDEN", "Forbidden", 403);

  const result = scorePointSchema.safeParse(await req.json());
  if (!result.success) return apiError("VALIDATION", "Invalid request payload", 400, result.error.flatten());

  const allowedPoints = run.pointSystem === "one_two" ? [1, 2] : [2, 3];

  try {
    const event = await recordScore(
      gameId,
      run.id,
      result.data.queueEntryId,
      result.data.team,
      result.data.points,
      allowedPoints,
    );
    return apiSuccess(event, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string; gameId: string }> },
): Promise<Response> {
  const { code, gameId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  if (!userId) return apiError("UNAUTHORIZED", "Unauthorized", 401);

  const run = await getRunByCode(code);
  if (!run) return apiError("NOT_FOUND", "Run not found", 404);
  if (run.hostId !== userId) return apiError("FORBIDDEN", "Forbidden", 403);

  try {
    const event = await undoLastScore(gameId, run.id);
    if (!event) return apiError("NO_SCORE_TO_UNDO", "No score to undo", 422);
    return apiSuccess(event);
  } catch (err) {
    return handleApiError(err);
  }
}
