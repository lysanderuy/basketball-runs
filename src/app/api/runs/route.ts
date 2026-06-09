import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRunSchema } from "@/lib/validations";
import { createRun, getRunsForUser, getActiveRunByHostId } from "@/services/runs";

export async function GET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = claimsData.claims.sub;
  const userRuns = await getRunsForUser(userId);
  const result = userRuns.map(({ hostId, ...run }) => ({
    ...run,
    isHost: hostId === userId,
  }));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existingRun = await getActiveRunByHostId(claimsData.claims.sub);
  if (existingRun) {
    return NextResponse.json(
      { error: "You already have an active run", code: existingRun.sessionCode },
      { status: 409 }
    );
  }

  const body: unknown = await req.json();
  const result = createRunSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const run = await createRun({
    ...result.data,
    hostId: claimsData.claims.sub,
  });

  return NextResponse.json(run, { status: 201 });
}
