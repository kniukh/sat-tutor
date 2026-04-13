import { NextResponse } from "next/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { softRemoveStudentVocabularyItem } from "@/services/vocabulary/student-vocabulary.service";

export async function POST(request: Request) {
  const body = await request.json();
  const { studentId, vocabularyItemId } = body as {
    studentId: string;
    vocabularyItemId: string;
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
    const data = await softRemoveStudentVocabularyItem({
      studentId: sessionStudentId,
      vocabularyItemId: vocabularyItemId.trim(),
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to delete vocabulary item" },
      { status: 500 }
    );
  }
}
