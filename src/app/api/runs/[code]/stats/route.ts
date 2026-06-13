import { NextRequest } from "next/server";
import { getRunByCode, getRunStats } from "@/services/run.service";
import { apiSuccess, apiError } from "@/lib/api/response";

// GET /api/runs/[code]/stats — run-level totals (game count, total points,
// top scorer) for the "Run ended" summary block on the feed. Read-only and
// public-read, same as the existing games route.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const run = await getRunByCode(code);
  if (!run) return apiError("NOT_FOUND", "Run not found", 404);

  const stats = await getRunStats(run.id);
  return apiSuccess(stats);
}
