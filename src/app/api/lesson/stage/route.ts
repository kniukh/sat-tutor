import { NextResponse } from 'next/server';
import {
  getOrCreateStudentLessonState,
  updateStudentLessonStage,
  type LessonStage,
} from '@/services/lesson-state/lesson-state.service';

const allowedStages: LessonStage[] = [
  'first_read',
  'vocab_review',
  'second_read',
  'questions',
  'completed',
];

export async function POST(request: Request) {
  const body = await request.json();

  const {
    studentId,
    lessonId,
    stage,
    vocabSubmitted,
    secondReadDone,
  }: {
    studentId: string;
    lessonId: string;
    stage: LessonStage;
    vocabSubmitted?: boolean;
    secondReadDone?: boolean;
  } = body;

  if (!studentId || !lessonId || !stage || !allowedStages.includes(stage)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    await getOrCreateStudentLessonState(studentId, lessonId);

    const data = await updateStudentLessonStage({
      studentId,
      lessonId,
      stage,
      vocabSubmitted,
      secondReadDone,
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Stage update failed' },
      { status: 500 },
    );
  }
}