import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function updateStudentBookProgress(params: {
  studentId: string;
  lessonId: string;
}) {
  const supabase = createServerSupabaseClient();

  const { data: generatedPassage, error: generatedError } = await supabase
    .from('generated_passages')
    .select('*')
    .eq('lesson_id', params.lessonId)
    .maybeSingle();

  if (generatedError) {
    throw generatedError;
  }

  if (!generatedPassage?.source_document_id) {
    return null;
  }

  const sourceDocumentId = generatedPassage.source_document_id;

  const { data: generatedPassages, error: passagesError } = await supabase
    .from('generated_passages')
    .select('lesson_id')
    .eq('source_document_id', sourceDocumentId)
    .not('lesson_id', 'is', null);

  if (passagesError) {
    throw passagesError;
  }

  const lessonIds = (generatedPassages ?? [])
    .map((item) => item.lesson_id)
    .filter(Boolean);

  const totalLessonsCount = lessonIds.length;

  const { data: attempts, error: attemptsError } = await supabase
    .from('lesson_attempts')
    .select('lesson_id')
    .eq('student_id', params.studentId)
    .in(
      'lesson_id',
      lessonIds.length > 0 ? lessonIds : ['00000000-0000-0000-0000-000000000000'],
    );

  if (attemptsError) {
    throw attemptsError;
  }

  const completedLessonIds = new Set((attempts ?? []).map((item) => item.lesson_id));
  const completedLessonsCount = completedLessonIds.size;

  const progressPercent =
    totalLessonsCount > 0
      ? Number(((completedLessonsCount / totalLessonsCount) * 100).toFixed(2))
      : 0;

  const { data: existing, error: existingError } = await supabase
    .from('student_book_progress')
    .select('*')
    .eq('student_id', params.studentId)
    .eq('source_document_id', sourceDocumentId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    const { data, error } = await supabase
      .from('student_book_progress')
      .insert({
        student_id: params.studentId,
        source_document_id: sourceDocumentId,
        current_lesson_id: params.lessonId,
        last_opened_at: new Date().toISOString(),
        completed_lessons_count: completedLessonsCount,
        total_lessons_count: totalLessonsCount,
        progress_percent: progressPercent,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from('student_book_progress')
    .update({
      current_lesson_id: params.lessonId,
      last_opened_at: new Date().toISOString(),
      completed_lessons_count: completedLessonsCount,
      total_lessons_count: totalLessonsCount,
      progress_percent: progressPercent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getStudentBookProgress(studentId: string) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('student_book_progress')
    .select(`
      *,
      source_documents (*),
      lessons (*)
    `)
    .eq('student_id', studentId)
    .order('last_opened_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}