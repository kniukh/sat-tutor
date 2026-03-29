import { NextResponse } from 'next/server';
import { updateStudentBookProgress } from '@/services/reading/book-progress.service';

export async function POST(request: Request) {
  const body = await request.json();
  const { studentId, lessonId } = body as {
    studentId: string;
    lessonId: string;
  };

  if (!studentId || !lessonId) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const data = await updateStudentBookProgress({ studentId, lessonId });
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to update book progress' },
      { status: 500 },
    );
  }
}
