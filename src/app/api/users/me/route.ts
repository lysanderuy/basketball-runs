import { NextResponse } from "next/server";

// GET   /api/users/me — fetch authenticated user profile
// PATCH /api/users/me — update display name
export async function GET(): Promise<Response> {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}

export async function PATCH(): Promise<Response> {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
