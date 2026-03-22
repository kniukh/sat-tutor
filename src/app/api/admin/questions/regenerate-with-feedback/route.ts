import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { regenerateSatQuestionWithFeedback } from '@/services/ai/regenerate-sat-question-with-feedback';

export async function POST(request: Request) {
  const body = await request.json();
  const { questionId, feedback } = body;

  if (!feedback || !String(feedback).trim()) {
    return NextResponse.json({ error: 'Feedback is required' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: question, error: questionError } = await supabase
    .from('question_bank')
    .select('*')
    .eq('id', questionId)
    .single();

  if (questionError || !question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  }

  const { data: passage, error: passageError } = await supabase
    .from('lesson_passages')
    .select('*')
    .eq('lesson_id', question.lesson_id)
    .order('display_order', { ascending: true })
    .limit(1)
    .single();

  if (passageError || !passage) {
    return NextResponse.json({ error: 'Passage not found' }, { status: 404 });
  }

  let generated;
  try {
    generated = await regenerateSatQuestionWithFeedback({
      passageTitle: passage.title,
      passageText: passage.passage_text,
      originalQuestion: {
        question_type: question.question_type,
        question_text: question.question_text,
        option_a: question.option_a,
        option_b: question.option_b,
        option_c: question.option_c,
        option_d: question.option_d,
        correct_option: question.correct_option,
        explanation: question.explanation,
        difficulty: question.difficulty,
      },
      feedback: String(feedback),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Regeneration with feedback failed' },
      { status: 500 },
    );
  }

  const nextVersion = Number(question.generation_version ?? 1) + 1;

  const { data, error } = await supabase
    .from('question_bank')
    .update({
      question_type: generated.question_type,
      question_text: generated.question_text,
      option_a: generated.option_a,
      option_b: generated.option_b,
      option_c: generated.option_c,
      option_d: generated.option_d,
      correct_option: generated.correct_option,
      explanation: generated.explanation,
      difficulty: generated.difficulty,
      review_status: 'draft',
      generation_source: 'ai',
      generation_version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq('id', questionId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}