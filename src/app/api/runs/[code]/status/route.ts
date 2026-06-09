import { NextRequest, NextResponse } from "next/server";
import { getRunByCode, closeRun } from "@/services/runs";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateStatusSchema = z.object({ status: z.literal("completed") });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await params;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const run = await getRunByCode(code);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  if (run.hostId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = updateStatusSchema.safeParse(await req.json());
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  try {
    const updated = await closeRun(run.id);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
