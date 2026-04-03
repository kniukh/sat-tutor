import { NextResponse } from 'next/server';
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { updateStudentLessonStage } from '@/services/lesson-state/lesson-state.service';

export async function POST(request: Request) {
  const body = await request.json();

  const {
    studentId,
    lessonId,
    action,
  }: {
    studentId: string;
    lessonId: string;
    action: 'start_second_read' | 'done_second_read' | 'mark_completed';
  } = body;

  try {
    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId is required' }, { status: 400 });
    }

    const sessionStudentId = await requireStudentApiStudentId(studentId);

    if (action === 'start_second_read') {
      const data = await updateStudentLessonStage({
        studentId: sessionStudentId,
        lessonId,
        stage: 'second_read',
      });

      return NextResponse.json({ data });
    }

    if (action === 'done_second_read') {
      const data = await updateStudentLessonStage({
        studentId: sessionStudentId,
        lessonId,
        stage: 'questions',
        secondReadDone: true,
      });

      return NextResponse.json({ data });
    }

    if (action === 'mark_completed') {
      const data = await updateStudentLessonStage({
        studentId: sessionStudentId,
        lessonId,
        stage: 'completed',
      });

      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error?.message ?? 'Stage advance failed' },
      { status: 500 },
    );
  }
}
