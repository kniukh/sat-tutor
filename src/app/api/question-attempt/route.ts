import { NextResponse } from "next/server";
import { saveQuestionAttempt } from "@/services/analytics/question-attempts.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      studentId,
      lessonId,
      questionId,
      selectedOption,
      durationSec,
    }: {
      studentId: string;
      lessonId: string;
      questionId: string;
      selectedOption: string;
      durationSec: number;
    } = body;

    if (
      !studentId ||
      !lessonId ||
      !questionId ||
      !selectedOption ||
      !Number.isFinite(durationSec)
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const result = await saveQuestionAttempt({
      studentId,
      lessonId,
      questionId,
      selectedOption,
      durationSec: Math.max(0, Math.round(durationSec)),
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("POST /api/question-attempt error", error);
    return NextResponse.json(
      { error: "Failed to save question attempt" },
      { status: 500 }
    );
  }
}
