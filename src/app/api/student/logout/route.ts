import { NextResponse } from "next/server";

import { logoutStudentSession } from "@/lib/auth/student";

export async function POST() {
  try {
    await logoutStudentSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/student/logout error", error);
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}
