import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateSatQuestionsFromPassage } from '@/services/ai/generate-sat-questions';

export async function POST(request: Request) {
  const body = await request.json();
  const { lessonId } = body;

  const supabase = createServerSupabaseClient();

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

  let generatedQuestions;
  try {
    generatedQuestions = await generateSatQuestionsFromPassage({
      title: lessonPassage.title,
      passageText: lessonPassage.passage_text,
      passageRole: generatedPassage?.passage_role ?? 'assessment',
      questionStrategy: generatedPassage?.question_strategy ?? 'full_set',
      recommendedQuestionCount: generatedPassage?.recommended_question_count ?? 5,
      recommendedQuestionTypes: generatedPassage?.recommended_question_types ?? [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Question generation failed' },
      { status: 500 },
    );
  }

  if (!generatedQuestions || generatedQuestions.length === 0) {
    return NextResponse.json({
      success: true,
      count: 0,
      skipped: true,
      message: 'Passage strategy indicates no questions should be generated.',
    });
  }

  const { data: existingQuestions } = await supabase
    .from('question_bank')
    .select('generation_version')
    .eq('lesson_id', lessonId)
    .order('generation_version', { ascending: false })
    .limit(1);

  const nextVersion = (existingQuestions?.[0]?.generation_version ?? 0) + 1;

  const rows = generatedQuestions.map((q, index) => ({
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