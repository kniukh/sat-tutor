import { NextResponse } from "next/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { saveLessonReadingMetrics } from "@/services/reading/reading-metrics.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      studentId,
      lessonId,
      readingDurationSec,
      wordsCount,
      wordsPerMinute,
    }: {
      studentId: string;
      lessonId: string;
      readingDurationSec: number;
      wordsCount: number;
      wordsPerMinute: number;
    } = body;

    if (!lessonId || !Number.isFinite(readingDurationSec) || !Number.isFinite(wordsCount) || !Number.isFinite(wordsPerMinute)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const sessionStudentId = await requireStudentApiStudentId(studentId);

    const result = await saveLessonReadingMetrics({
      studentId: sessionStudentId,
      lessonId,
      readingDurationSec: Math.max(0, Math.round(readingDurationSec)),
      wordsCount: Math.max(0, Math.round(wordsCount)),
      wordsPerMinute: Math.max(0, Number(wordsPerMinute.toFixed(2))),
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("POST /api/reading/metrics error", error);
    return NextResponse.json(
      { error: "Failed to save reading metrics" },
      { status: 500 }
    );
  }
}
