import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, location, format, scoreGoal, timeLimit, code } = body;

  if (!name || !location || !format || !scoreGoal || !code) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const [run] = await db
      .insert(runs)
      .values({ code, name, location, format, scoreGoal, timeLimit: timeLimit ?? null })
      .returning();
    return NextResponse.json({ run }, { status: 201 });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      return NextResponse.json({ error: "Run code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create run" }, { status: 500 });
  }
}
