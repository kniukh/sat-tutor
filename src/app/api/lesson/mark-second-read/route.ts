import { NextResponse } from "next/server";
import { markSecondReadDone } from "@/services/lesson-state/lesson-state.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = await markSecondReadDone(body.studentId, body.lessonId);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("POST /api/lesson/mark-second-read error", error);
    return NextResponse.json(
      { error: "Failed to mark second read done" },
      { status: 500 }
    );
  }
}
