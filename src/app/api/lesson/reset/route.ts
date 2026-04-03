import { NextResponse } from "next/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { createClient } from "@/lib/supabase/server";

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

    const supabase = await createClient();

    const { error: captureError } = await supabase
      .from("vocabulary_capture_events")
      .delete()
      .eq("student_id", sessionStudentId)
      .eq("lesson_id", lessonId);

    if (captureError) {
      console.error("captureError", captureError);
      return NextResponse.json({ error: captureError.message }, { status: 500 });
    }

    const { error: vocabError } = await supabase
      .from("vocabulary_item_details")
      .delete()
      .eq("student_id", sessionStudentId)
      .eq("lesson_id", lessonId);

    if (vocabError) {
      console.error("vocabError", vocabError);
      return NextResponse.json({ error: vocabError.message }, { status: 500 });
    }

    const { error: attemptsError } = await supabase
      .from("lesson_attempts")
      .delete()
      .eq("student_id", sessionStudentId)
      .eq("lesson_id", lessonId);

    if (attemptsError) {
      console.error("attemptsError", attemptsError);
      return NextResponse.json({ error: attemptsError.message }, { status: 500 });
    }

    const { error: stateError } = await supabase
      .from("student_lesson_state")
      .delete()
      .eq("student_id", sessionStudentId)
      .eq("lesson_id", lessonId);

    if (stateError) {
      console.error("stateError", stateError);
      return NextResponse.json({ error: stateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("lesson reset route error", error);
    return NextResponse.json(
      { error: "Failed to reset lesson" },
      { status: 500 }
    );
  }
}
