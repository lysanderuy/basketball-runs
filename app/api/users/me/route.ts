import { NextRequest, NextResponse } from "next/server";

// GET   /api/users/me — fetch authenticated user profile
// PATCH /api/users/me — update display name
export async function GET(req: NextRequest) {
  void req;
  return NextResponse.json({});
}

export async function PATCH(req: NextRequest) {
  void req;
  return NextResponse.json({});
}
