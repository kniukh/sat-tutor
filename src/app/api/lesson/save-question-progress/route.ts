import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json();

  const {
    studentId,
    lessonId,
    answers,
    currentQuestionIndex,
  }: {
    studentId: string;
    lessonId: string;
    answers: Record<string, 'A' | 'B' | 'C' | 'D'>;
    currentQuestionIndex: number;
  } = body;

  if (!studentId || !lessonId) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('student_lesson_state')
    .update({
      question_answers_json: answers ?? {},
      current_question_index: Number.isFinite(currentQuestionIndex)
        ? currentQuestionIndex
        : 0,
      updated_at: new Date().toISOString(),
    })
    .eq('student_id', studentId)
    .eq('lesson_id', lessonId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}