import { NextResponse } from "next/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { markWordProgressAsAlreadyKnown } from "@/services/vocabulary/exercise-progress.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      studentId,
      wordId,
      word,
      lessonId,
      sessionId,
      sessionMode,
    }: {
      studentId: string;
      wordId: string | null;
      word: string;
      lessonId?: string | null;
      sessionId?: string | null;
      sessionMode?: string | null;
    } = body;

    if (!word?.trim()) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const sessionStudentId = await requireStudentApiStudentId(studentId);
    const progress = await markWordProgressAsAlreadyKnown({
      studentId: sessionStudentId,
      wordId: wordId ?? null,
      word,
      lessonId: lessonId ?? null,
      sessionId: sessionId ?? null,
      sessionMode: sessionMode ?? null,
    });

    return NextResponse.json({ ok: true, data: progress });
  } catch (error: any) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("POST /api/vocabulary/already-know error", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to mark word as already known" },
      { status: 500 }
    );
  }
}
