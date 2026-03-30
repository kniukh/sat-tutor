import { NextResponse } from 'next/server';
import { prepareVocabularyDrillsForStudent } from '@/services/vocabulary/drill-preparation.service';

export async function POST(request: Request) {
  const body = await request.json();
  const { studentId, lessonId } = body as { studentId: string; lessonId?: string };

  if (!studentId) {
    return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
  }

  try {
    const result = await prepareVocabularyDrillsForStudent({
      studentId,
      lessonId,
    });

    return NextResponse.json({
      success: true,
      count: result.preparedCount,
      totalItems: result.totalItems,
      items: result.items,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to prepare drills' },
      { status: 500 },
    );
  }
}
