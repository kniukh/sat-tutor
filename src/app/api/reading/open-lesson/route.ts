import { NextResponse } from 'next/server';
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { updateStudentBookProgress } from '@/services/reading/book-progress.service';

export async function POST(request: Request) {
  const body = await request.json();
  const { studentId, lessonId } = body as {
    studentId: string;
    lessonId: string;
  };

  if (!lessonId) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const sessionStudentId = await requireStudentApiStudentId(studentId);
    const data = await updateStudentBookProgress({ studentId: sessionStudentId, lessonId });
    return NextResponse.json({ data });
  } catch (error: any) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error?.message ?? 'Failed to update book progress' },
      { status: 500 },
    );
  }
}
