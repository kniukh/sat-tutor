import { NextResponse } from "next/server";
import { completeLesson } from "@/services/lesson-state/complete-lesson.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, lessonId } = body;

    if (!studentId || !lessonId) {
      return NextResponse.json(
        { error: "studentId and lessonId are required" },
        { status: 400 }
      );
    }

    const result = await completeLesson(studentId, lessonId);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("POST /api/lesson/complete error", error);
    return NextResponse.json(
      { error: "Failed to complete lesson" },
      { status: 500 }
    );
  }
}
