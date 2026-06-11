import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRunSchema } from "@/validators";
import { createRun, getRunsForUser, getActiveRunByHostId } from "@/services/run.service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const userRuns = await getRunsForUser(user.id);
  const result = userRuns.map(({ hostId, ...run }) => ({
    ...run,
    isHost: hostId === user.id,
  }));
  return apiSuccess(result);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const existingRun = await getActiveRunByHostId(user.id);
  if (existingRun) {
    return apiError(
      "ACTIVE_RUN_EXISTS",
      "You already have an active run",
      409,
      { code: existingRun.sessionCode },
    );
  }

  const body: unknown = await req.json();
  const result = createRunSchema.safeParse(body);
  if (!result.success) {
    return apiError("VALIDATION", "Invalid request payload", 400, result.error.flatten());
  }

  const run = await createRun({
    ...result.data,
    hostId: user.id,
  });

  return apiSuccess(run, 201);
}
