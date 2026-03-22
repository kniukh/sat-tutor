import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function getBookOverviewForStudent(studentCode: string) {
  const supabase = createServerSupabaseClient();

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('access_code', studentCode)
    .eq('is_active', true)
    .single();

  if (studentError || !student) {
    throw new Error('Student not found');
  }

  const { data: attempts, error: attemptsError } = await supabase
    .from('lesson_attempts')
    .select('lesson_id, completed_at')
    .eq('student_id', student.id);

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

  const lessonIds = (generatedPassages ?? [])
    .map((item) => item.lesson_id)
    .filter(Boolean);

  const { data: lessons, error: lessonsError } = await supabase
    .from('lessons')
    .select('*')
    .in('id', lessonIds.length > 0 ? lessonIds : ['00000000-0000-0000-0000-000000000000']);

  if (lessonsError) {
    throw lessonsError;
  }

  const lessonMap = new Map((lessons ?? []).map((lesson) => [lesson.id, lesson]));

  const items = (generatedPassages ?? [])
    .filter((item) => item.lesson_id)
    .map((item) => {
      const lesson = lessonMap.get(item.lesson_id);
      if (!lesson || lesson.status !== 'published' || !lesson.is_active) {
        return null;
      }

      const isCompleted = completedLessonIds.has(item.lesson_id);

      return {
        generatedPassageId: item.id,
        sourceDocumentId: item.source_document_id,
        chunkIndex: item.chunk_index,
        passageRole: item.passage_role ?? 'assessment',
        questionStrategy: item.question_strategy ?? 'full_set',
        lessonId: item.lesson_id,
        lessonName: lesson.name,
        lessonType: lesson.lesson_type,
        isCompleted,
      };
    })
    .filter(Boolean) as Array<{
      generatedPassageId: string;
      sourceDocumentId: string;
      chunkIndex: number;
      passageRole: string;
      questionStrategy: string;
      lessonId: string;
      lessonName: string;
      lessonType: string;
      isCompleted: boolean;
    }>;

  const firstIncomplete = items.find((item) => !item.isCompleted) ?? null;

  const enrichedItems = items.map((item) => ({
    ...item,
    progressState: item.isCompleted
      ? 'completed'
      : firstIncomplete && firstIncomplete.lessonId === item.lessonId
        ? 'current'
        : 'upcoming',
  }));

  const firstSourceDocumentId = enrichedItems[0]?.sourceDocumentId ?? null;

  let sourceDocument = null;

  if (firstSourceDocumentId) {
    const { data } = await supabase
      .from('source_documents')
      .select('*')
      .eq('id', firstSourceDocumentId)
      .maybeSingle();

    sourceDocument = data ?? null;
  }

  const totalParts = enrichedItems.length;
  const completedParts = enrichedItems.filter((item) => item.progressState === 'completed').length;
  const progressPercent =
    totalParts > 0 ? Math.round((completedParts / totalParts) * 100) : 0;

  return {
    student,
    sourceDocument,
    items: enrichedItems,
    summary: {
      totalParts,
      completedParts,
      progressPercent,
      currentLessonId: firstIncomplete?.lessonId ?? enrichedItems.at(-1)?.lessonId ?? null,
    },
  };
}