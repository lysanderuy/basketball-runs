import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRunByCode, updateRunStatus } from "@/services/runs";
import { createClient } from "@/lib/supabase/server";

const updateStatusSchema = z.object({
  status: z.enum(["lobby", "active", "completed"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await params;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await getRunByCode(code);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (run.hostId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = updateStatusSchema.safeParse(await req.json());
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const updated = await updateRunStatus(run.id, result.data.status);
  return NextResponse.json(updated);
}
