import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateSatQuestionsFromPassage } from '@/services/ai/generate-sat-questions';

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function inferPassageKind(sourceType: string | null | undefined) {
  if (sourceType === 'poem') {
    return 'poem';
  }

  if (sourceType === 'article' || sourceType === 'essay') {
    return 'article';
  }

  return 'prose';
}

export async function createAiLessonFromGeneratedPassage(params: {
  generatedPassageId: string;
  unitId: string;
}) {
  const supabase = await createServerSupabaseClient();

  const { data: passage, error: passageError } = await supabase
    .from('generated_passages')
    .select('*')
    .eq('id', params.generatedPassageId)
    .single();

  if (passageError || !passage) {
    throw new Error('Generated passage not found');
  }

  if (passage.lesson_id) {
    const { data: existingLesson, error: existingLessonError } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', passage.lesson_id)
      .single();

    if (existingLessonError || !existingLesson) {
      throw new Error(existingLessonError?.message ?? 'Existing lesson not found');
    }

    return existingLesson;
  }

  const { data: source } = await supabase
    .from('source_documents')
    .select('id, title, author, source_type, metadata')
    .eq('id', passage.source_document_id)
    .maybeSingle();

  const baseName =
    passage.title ||
    source?.title ||
    `Generated Passage ${Number(passage.chunk_index ?? 0) + 1}`;
  const chapterPrefix = passage.chapter_title ? `${passage.chapter_title} — ` : '';
  const lessonName = `${chapterPrefix}${baseName}`.slice(0, 120);
  const lessonSlug = `${makeSlug(lessonName)}-${Date.now()}`;

  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .insert({
      unit_id: params.unitId,
      name: lessonName,
      slug: lessonSlug,
      lesson_type: 'reading_vocab',
      status: 'draft',
      is_active: true,
      display_order: 0,
    })
    .select()
    .single();

  if (lessonError || !lesson) {
    throw new Error(lessonError?.message ?? 'Lesson create failed');
  }

  const { error: lessonPassageError } = await supabase
    .from('lesson_passages')
    .insert({
      lesson_id: lesson.id,
      title: passage.title || source?.title || null,
      passage_text: passage.passage_text,
      passage_kind: inferPassageKind(source?.source_type),
      author: source?.author ?? null,
      word_count: passage.word_count ?? null,
      is_primary: true,
      display_order: 1,
    });

  if (lessonPassageError) {
    throw new Error(lessonPassageError.message);
  }

  const { data: existingQuestions } = await supabase
    .from('question_bank')
    .select('generation_version')
    .eq('lesson_id', lesson.id)
    .order('generation_version', { ascending: false })
    .limit(1);

  const nextVersion = (existingQuestions?.[0]?.generation_version ?? 0) + 1;

  const [satQuestions, vocabQuestions] = await Promise.all([
    generateSatQuestionsFromPassage({
      title: passage.title,
      passageText: passage.passage_text,
      passageRole: 'assessment',
      questionStrategy: 'full_set',
      recommendedQuestionCount: 2,
      recommendedQuestionTypes: ['main_idea', 'detail', 'inference', 'tone'],
    }),
    generateSatQuestionsFromPassage({
      title: passage.title,
      passageText: passage.passage_text,
      passageRole: 'assessment',
      questionStrategy: 'full_set',
      recommendedQuestionCount: 2,
      recommendedQuestionTypes: ['vocabulary'],
    }),
  ]);

  const questionRows = [...satQuestions.slice(0, 2), ...vocabQuestions.slice(0, 2)].map(
    (question, index) => ({
      lesson_id: lesson.id,
      question_type: question.question_type,
      question_text: question.question_text,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      correct_option: question.correct_option,
      explanation: question.explanation,
      difficulty: question.difficulty,
      display_order: index + 1,
      review_status: 'draft',
      generation_source: 'ai',
      generation_version: nextVersion,
    })
  );

  if (questionRows.length > 0) {
    const { error: questionInsertError } = await supabase
      .from('question_bank')
      .insert(questionRows);

    if (questionInsertError) {
      throw new Error(questionInsertError.message);
    }
  }

  const { error: updateGeneratedError } = await supabase
    .from('generated_passages')
    .update({
      status: 'approved',
      lesson_id: lesson.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.generatedPassageId);

  if (updateGeneratedError) {
    throw new Error(updateGeneratedError.message);
  }

  return lesson;
}
