import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runPlayers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  const { id } = await params;

  const deleted = await db
    .delete(runPlayers)
    .where(eq(runPlayers.id, id))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
