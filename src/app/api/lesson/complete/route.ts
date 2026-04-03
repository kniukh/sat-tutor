import { NextResponse } from "next/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { completeLesson } from "@/services/lesson-state/complete-lesson.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, lessonId } = body;

    if (!lessonId) {
      return NextResponse.json(
        { error: "studentId and lessonId are required" },
        { status: 400 }
      );
    }

    const sessionStudentId = await requireStudentApiStudentId(studentId);
    const result = await completeLesson(sessionStudentId, lessonId);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("POST /api/lesson/complete error", error);
    return NextResponse.json(
      { error: "Failed to complete lesson" },
      { status: 500 }
    );
  }
}
