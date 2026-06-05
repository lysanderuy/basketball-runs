import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRunSchema } from "@/lib/validations";
import { createRun, getRunsByHostId } from "@/services/runs";

export async function GET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRuns = await getRunsByHostId(claimsData.claims.sub);
  return NextResponse.json(userRuns);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
