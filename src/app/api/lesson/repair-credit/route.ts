import { NextResponse } from "next/server";
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

    if (!studentId || !lessonId || !questionId || !Number.isFinite(comboCountAfter)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const reward = await awardReadingMistakeFixXp({
      studentId,
      lessonId,
      questionId,
      comboCountAfter: Math.max(1, Math.round(comboCountAfter)),
    });

    return NextResponse.json({ ok: true, data: reward });
  } catch (error: any) {
    console.error("POST /api/lesson/repair-credit error", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to award repair credit" },
      { status: 500 }
    );
  }
}
