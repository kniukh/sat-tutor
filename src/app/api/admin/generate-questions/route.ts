import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateChunkLessonPackage } from '@/services/ai/generate-chunk-lesson-package';

export async function POST(request: Request) {
  const body = await request.json();
  const { lessonId } = body;

  const supabase = await createServerSupabaseClient();

  const { data: lessonPassages, error: lessonPassagesError } = await supabase
    .from('lesson_passages')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('display_order', { ascending: true });

  if (lessonPassagesError || !lessonPassages || lessonPassages.length === 0) {
    return NextResponse.json({ error: 'No lesson passage found' }, { status: 404 });
  }

  const lessonPassage = lessonPassages[0];

  const { data: generatedPassage } = await supabase
    .from('generated_passages')
    .select('*')
    .eq('lesson_id', lessonId)
    .maybeSingle();

  let generatedPackage;
  try {
    generatedPackage = await generateChunkLessonPackage({
      title: lessonPassage.title,
      passageText: lessonPassage.passage_text,
      sourceType:
        lessonPassage.passage_kind === 'poem'
          ? 'poem'
          : lessonPassage.passage_kind === 'article'
            ? 'article'
            : 'book',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Question generation failed' },
      { status: 500 },
    );
  }

  if (generatedPassage?.id) {
    await supabase
      .from('generated_passages')
      .update({
        passage_role: generatedPackage.passage_role,
        question_strategy: generatedPackage.question_strategy,
        recommended_question_count: generatedPackage.recommended_question_count,
        recommended_question_types: generatedPackage.recommended_question_types,
        analyzer_reason: generatedPackage.analyzer_reason,
        difficulty_level: generatedPackage.difficulty_level,
        text_mode: generatedPackage.text_mode,
        vocab_density: generatedPackage.vocab_density,
        phrase_density: generatedPackage.phrase_density,
        writing_prompt_worthy: generatedPackage.writing_prompt_worthy,
        recommended_vocab_questions_count: generatedPackage.recommended_vocab_questions_count,
        recommended_vocab_target_words: generatedPackage.recommended_vocab_target_words,
        recommended_vocab_target_phrases: generatedPackage.recommended_vocab_target_phrases,
        updated_at: new Date().toISOString(),
      })
      .eq('id', generatedPassage.id);
  }

  const { data: existingQuestions } = await supabase
    .from('question_bank')
    .select('generation_version')
    .eq('lesson_id', lessonId)
    .order('generation_version', { ascending: false })
    .limit(1);

  const nextVersion = (existingQuestions?.[0]?.generation_version ?? 0) + 1;

  const rows = [...generatedPackage.sat_questions, ...generatedPackage.vocab_questions].map((q, index) => ({
    lesson_id: lessonId,
    question_type: q.question_type,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_option: q.correct_option,
    explanation: q.explanation,
    difficulty: q.difficulty,
    display_order: index + 1,
    review_status: 'draft',
    generation_source: 'ai',
    generation_version: nextVersion,
  }));

  const { error: insertError } = await supabase.from('question_bank').insert(rows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    count: rows.length,
    generationVersion: nextVersion,
  });
}
