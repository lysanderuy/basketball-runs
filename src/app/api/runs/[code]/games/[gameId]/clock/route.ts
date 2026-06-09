import { NextRequest, NextResponse } from "next/server";
import { getRunByCode, clockAction } from "@/services/runs";
import { clockActionSchema } from "@/lib/validations";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
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

  const result = clockActionSchema.safeParse(await req.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  try {
    const game = await clockAction(gameId, result.data.action);
    return NextResponse.json(game);
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
