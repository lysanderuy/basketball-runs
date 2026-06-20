import { NextRequest } from "next/server";
import { getRunByCode } from "@/services/run.service";
import { getTopScorersByRunId } from "@/services/game.service";
import { apiSuccess, apiError } from "@/lib/api/response";

// GET /api/runs/[code]/games/top-scorers — one entry per completed game in
// the run: the top scorer (or null if nobody scored). Powers the compact
// "Top: <name> — N pts" line on each past-game card on the feed without
// N+1 game-detail fetches. Read-only and public-read.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const run = await getRunByCode(code);
  if (!run) return apiError("NOT_FOUND", "Run not found", 404);

  const topScorers = await getTopScorersByRunId(run.id);
  return apiSuccess(topScorers);
}
