import { NextResponse } from "next/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { submitLessonVocabularyReview, submitVocabulary } from "@/services/lesson-state/lesson-state.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.lessonId) {
      return NextResponse.json({ error: "lessonId is required" }, { status: 400 });
    }

    const sessionStudentId = await requireStudentApiStudentId(body.studentId);
    const result =
      Array.isArray(body.items) || body.passageId
        ? await submitLessonVocabularyReview({
            studentId: sessionStudentId,
            lessonId: body.lessonId,
            passageId: body.passageId ?? null,
            items: Array.isArray(body.items) ? body.items : [],
          })
        : await submitVocabulary(sessionStudentId, body.lessonId);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("POST /api/lesson/submit-vocabulary error", error);
    return NextResponse.json(
      { error: "Failed to submit vocabulary" },
      { status: 500 }
    );
  }
}
