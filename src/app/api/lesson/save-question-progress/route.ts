import { NextResponse } from "next/server";
import { saveQuestionProgress } from "@/services/lesson-state/lesson-state.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = await saveQuestionProgress({
      studentId: body.studentId,
      lessonId: body.lessonId,
      questionId: body.questionId,
      selectedOption: body.selectedOption,
      skill: body.skill,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("POST /api/lesson/save-question-progress error", error);
    return NextResponse.json(
      { error: "Failed to save question progress" },
      { status: 500 }
    );
  }
}
