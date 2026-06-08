import { NextRequest, NextResponse } from "next/server";
import { queueEntryPatchSchema } from "@/lib/validations";
import { getRunByCode } from "@/services/runs";
import { updateQueueEntryStatus, updateQueueEntrySittingOut } from "@/services/queue";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/runs/[code]/queue/[entryId]
// Accepts { status } or { sittingOut } — host only.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; entryId: string }> },
): Promise<Response> {
  const { code, entryId } = await params;

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

  const result = queueEntryPatchSchema.safeParse(await req.json());
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const entry =
    "status" in result.data
      ? await updateQueueEntryStatus(entryId, result.data.status)
      : await updateQueueEntrySittingOut(entryId, result.data.sittingOut);

  if (!entry) {
    return NextResponse.json({ error: "Queue entry not found" }, { status: 404 });
  }

  return NextResponse.json(entry);
}
