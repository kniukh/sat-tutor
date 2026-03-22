import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function getLessonSequenceByCurrentLessonId(currentLessonId: string) {
  const supabase = createServerSupabaseClient();

  const { data: currentGeneratedPassage, error: currentError } = await supabase
    .from('generated_passages')
    .select('*')
    .eq('lesson_id', currentLessonId)
    .maybeSingle();

  if (currentError) {
    throw currentError;
  }

  if (!currentGeneratedPassage) {
    return {
      previousLesson: null,
      nextLesson: null,
      currentGeneratedPassage: null,
    };
  }

  const { data: allGeneratedPassages, error: allError } = await supabase
    .from('generated_passages')
    .select('*')
    .eq('source_document_id', currentGeneratedPassage.source_document_id)
    .not('lesson_id', 'is', null)
    .order('chunk_index', { ascending: true });

  if (allError) {
    throw allError;
  }

  const items = allGeneratedPassages ?? [];
  const index = items.findIndex((item) => item.lesson_id === currentLessonId);

  const previousGenerated = index > 0 ? items[index - 1] : null;
  const nextGenerated = index >= 0 && index < items.length - 1 ? items[index + 1] : null;

  let previousLesson = null;
  let nextLesson = null;

  if (previousGenerated?.lesson_id) {
    const { data } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', previousGenerated.lesson_id)
      .maybeSingle();

    previousLesson = data ?? null;
  }

  if (nextGenerated?.lesson_id) {
    const { data } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', nextGenerated.lesson_id)
      .maybeSingle();

    nextLesson = data ?? null;
  }

  return {
    previousLesson,
    nextLesson,
    currentGeneratedPassage,
  };
}

export async function getNextReadingLessonForStudent(studentId: string) {
  const supabase = createServerSupabaseClient();

  const { data: attempts, error: attemptsError } = await supabase
    .from('lesson_attempts')
    .select('lesson_id, completed_at')
    .eq('student_id', studentId)
    .order('completed_at', { ascending: false });

  if (attemptsError) {
    throw attemptsError;
  }

  const completedLessonIds = new Set((attempts ?? []).map((item) => item.lesson_id));

  const { data: generatedPassages, error: generatedError } = await supabase
    .from('generated_passages')
    .select('*')
    .not('lesson_id', 'is', null)
    .order('created_at', { ascending: true })
    .order('chunk_index', { ascending: true });

  if (generatedError) {
    throw generatedError;
  }

  const nextGeneratedPassage =
    (generatedPassages ?? []).find((item) => item.lesson_id && !completedLessonIds.has(item.lesson_id)) ??
    null;

  if (!nextGeneratedPassage?.lesson_id) {
    return null;
  }

  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', nextGeneratedPassage.lesson_id)
    .eq('is_active', true)
    .eq('status', 'published')
    .maybeSingle();

  if (lessonError) {
    throw lessonError;
  }

  return lesson ?? null;
}