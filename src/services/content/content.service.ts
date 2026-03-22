import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function getContentTree() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('programs')
    .select(`
      *,
      subjects (
        *,
        collections (
          *,
          units (
            *,
            lessons (*)
          )
        )
      )
    `)
    .order('display_order', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getPublishedLessonById(lessonId: string) {
  const supabase = createServerSupabaseClient();

  const { data: lesson, error } = await supabase
    .from('lessons')
    .select(`
      *,
      lesson_passages (*),
      question_bank (*)
    `)
    .eq('id', lessonId)
    .eq('status', 'published')
    .eq('is_active', true)
    .single();

  if (error) {
    throw error;
  }

  const filteredQuestions = (lesson.question_bank ?? []).filter((question: any) => {
    const source = question.generation_source ?? 'manual';
    const reviewStatus = question.review_status ?? 'approved';

    if (source === 'manual') {
      return reviewStatus !== 'rejected';
    }

    return reviewStatus === 'approved';
  });

  return {
    ...lesson,
    question_bank: filteredQuestions,
  };
}