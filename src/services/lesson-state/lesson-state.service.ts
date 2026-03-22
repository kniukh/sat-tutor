import { createServerSupabaseClient } from '@/lib/supabase/server';

export type LessonStage =
  | 'first_read'
  | 'vocab_review'
  | 'second_read'
  | 'questions'
  | 'completed';

export async function getOrCreateStudentLessonState(
  studentId: string,
  lessonId: string,
) {
  const supabase = createServerSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from('student_lesson_state')
    .select('*')
    .eq('student_id', studentId)
    .eq('lesson_id', lessonId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: createError } = await supabase
    .from('student_lesson_state')
    .insert({
      student_id: studentId,
      lesson_id: lessonId,
      stage: 'first_read',
      vocab_submitted: false,
      second_read_done: false,
    })
    .select()
    .single();

  if (createError) {
    throw createError;
  }

  return created;
}

export async function updateStudentLessonStage(params: {
  studentId: string;
  lessonId: string;
  stage: LessonStage;
  vocabSubmitted?: boolean;
  secondReadDone?: boolean;
}) {
  const supabase = createServerSupabaseClient();

  const payload: Record<string, unknown> = {
    stage: params.stage,
    updated_at: new Date().toISOString(),
  };

  if (typeof params.vocabSubmitted === 'boolean') {
    payload.vocab_submitted = params.vocabSubmitted;
  }

  if (typeof params.secondReadDone === 'boolean') {
    payload.second_read_done = params.secondReadDone;
  }

  const { data, error } = await supabase
    .from('student_lesson_state')
    .update(payload)
    .eq('student_id', params.studentId)
    .eq('lesson_id', params.lessonId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}