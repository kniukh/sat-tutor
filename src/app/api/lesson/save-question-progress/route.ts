import { NextResponse } from "next/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { saveQuestionProgress } from "@/services/lesson-state/lesson-state.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.lessonId || !body.questionId || !body.selectedOption) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const sessionStudentId = await requireStudentApiStudentId(body.studentId);
    const result = await saveQuestionProgress({
      studentId: sessionStudentId,
      lessonId: body.lessonId,
      questionId: body.questionId,
      selectedOption: body.selectedOption,
      skill: body.skill,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("POST /api/lesson/save-question-progress error", error);
    return NextResponse.json(
      { error: "Failed to save question progress" },
      { status: 500 }
    );
  }
}
