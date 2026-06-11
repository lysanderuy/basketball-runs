import { NextRequest } from "next/server";
import { getRunByCode } from "@/services/run.service";
import { clockAction } from "@/services/game.service";
import { clockActionSchema } from "@/validators";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(
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

  const result = clockActionSchema.safeParse(await req.json());
  if (!result.success) return apiError("VALIDATION", "Invalid request payload", 400, result.error.flatten());

  try {
    const game = await clockAction(gameId, run.id, result.data.action);
    return apiSuccess(game);
  } catch (err) {
    return handleApiError(err);
  }
}
