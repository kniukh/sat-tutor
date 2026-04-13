import { NextResponse } from "next/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { regenerateStudentVocabularyMeaningOverride } from "@/services/vocabulary/student-vocabulary.service";

export async function POST(request: Request) {
  const body = await request.json();
  const {
    studentId,
    vocabularyItemId,
    contextText,
  } = body as {
    studentId: string;
    vocabularyItemId: string;
    contextText?: string | null;
  };

  if (!vocabularyItemId?.trim()) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  let sessionStudentId: string;

  try {
    sessionStudentId = await requireStudentApiStudentId(studentId);
  } catch (error) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  try {
    const data = await regenerateStudentVocabularyMeaningOverride({
      studentId: sessionStudentId,
      vocabularyItemId: vocabularyItemId.trim(),
      contextText: contextText?.trim() || null,
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to regenerate vocabulary meaning" },
      { status: 500 }
    );
  }
}
