import { NextResponse } from 'next/server';
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { recordVocabularyCaptures } from "@/services/vocabulary/vocabulary-capture.service";

export async function POST(request: Request) {
  const body = await request.json();

  const { studentId, lessonId, passageId, items }: {
    studentId: string;
    lessonId: string;
    passageId?: string;
    items: Array<{
      itemText: string;
      itemType: 'word' | 'phrase';
      contextText?: string;
      sourceType?: "passage" | "question" | "answer";
      preview?: {
        plainEnglishMeaning?: string | null;
        translation?: string | null;
        contextMeaning?: string | null;
      } | null;
    }>;
  } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'No items provided' }, { status: 400 });
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
    await recordVocabularyCaptures({
      studentId: sessionStudentId,
      lessonId,
      passageId: passageId ?? null,
      items: items.map((item) => ({
        itemText: item.itemText,
        itemType: item.itemType,
        sourceType: item.sourceType,
        contextText: item.contextText ?? null,
        metadata: {
          preview: item.preview ?? null,
        },
      })),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to save captures" }, { status: 500 });
  }
}
