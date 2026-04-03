import { NextResponse } from "next/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { awardReadingMistakeFixXp } from "@/services/gamification/xp-awards.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      studentId,
      lessonId,
      questionId,
      comboCountAfter,
    }: {
      studentId: string;
      lessonId: string;
      questionId: string;
      comboCountAfter: number;
    } = body;

    if (!lessonId || !questionId || !Number.isFinite(comboCountAfter)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const sessionStudentId = await requireStudentApiStudentId(studentId);
    const reward = await awardReadingMistakeFixXp({
      studentId: sessionStudentId,
      lessonId,
      questionId,
      comboCountAfter: Math.max(1, Math.round(comboCountAfter)),
    });

    return NextResponse.json({ ok: true, data: reward });
  } catch (error: any) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("POST /api/lesson/repair-credit error", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to award repair credit" },
      { status: 500 }
    );
  }
}
