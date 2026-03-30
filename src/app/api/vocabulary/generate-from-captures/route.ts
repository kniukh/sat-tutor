import { NextResponse } from "next/server";
import { ensureLessonVocabularyDrillsReady } from "@/services/vocabulary/drill-preparation.service";

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

    const result = await ensureLessonVocabularyDrillsReady({
      studentId,
      lessonId,
    });

    return NextResponse.json({ ok: true, items: result.items, result });
  } catch (error) {
    console.error("generate-from-captures route error", error);
    return NextResponse.json(
      { error: "Failed to generate vocabulary items" },
      { status: 500 }
    );
  }
}
