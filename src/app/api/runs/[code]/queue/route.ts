import { NextRequest, NextResponse } from "next/server";
import { joinRunSchema } from "@/lib/validations";
import { getRunByCode } from "@/services/runs";
import { joinQueue } from "@/services/queue";
import { createClient } from "@/lib/supabase/server";

// GET  /api/runs/[code]/queue — fetch all queue entries
// POST /api/runs/[code]/queue — join queue (guest or authenticated)
export async function GET(): Promise<Response> {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const result = joinRunSchema.safeParse(await req.json());
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const run = await getRunByCode(code);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (run.status === "completed") {
    return NextResponse.json({ error: "This run has ended" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;

  const entry = await joinQueue(run.id, result.data.displayName, userId);

  return NextResponse.json(entry, { status: 201 });
}
