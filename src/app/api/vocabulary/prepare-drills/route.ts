import { NextResponse } from 'next/server';
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { prepareVocabularyDrillsForStudent } from '@/services/vocabulary/drill-preparation.service';

export async function POST(request: Request) {
  const body = await request.json();
  const { studentId, lessonId } = body as { studentId: string; lessonId?: string };

  try {
    const sessionStudentId = await requireStudentApiStudentId(studentId);
    const result = await prepareVocabularyDrillsForStudent({
      studentId: sessionStudentId,
      lessonId,
    });

    return NextResponse.json({
      success: true,
      count: result.preparedCount,
      totalItems: result.totalItems,
      items: result.items,
    });
  } catch (error: any) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error?.message ?? 'Failed to prepare drills' },
      { status: 500 },
    );
  }
}
