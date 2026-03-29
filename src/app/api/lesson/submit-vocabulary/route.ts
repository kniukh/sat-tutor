import { NextResponse } from "next/server";
import { submitVocabulary } from "@/services/lesson-state/lesson-state.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = await submitVocabulary(body.studentId, body.lessonId);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("POST /api/lesson/submit-vocabulary error", error);
    return NextResponse.json(
      { error: "Failed to submit vocabulary" },
      { status: 500 }
    );
  }
}
