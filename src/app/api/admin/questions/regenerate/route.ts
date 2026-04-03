import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { extractCachedChunkAnalysis } from '@/services/ai/chunk-generation-cache';
import { buildPassageExcerptForQuestion } from '@/services/ai/passage-context-window';
import { regenerateSatQuestionWithFeedback } from '@/services/ai/regenerate-sat-question-with-feedback';

export async function POST(request: Request) {
  const body = await request.json();
  const { questionId } = body;

  const supabase = await createServerSupabaseClient();

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

  const { data: generatedPassage } = await supabase
    .from('generated_passages')
    .select('*')
    .eq('lesson_id', question.lesson_id)
    .maybeSingle();

  let generated;
  try {
    generated = await regenerateSatQuestionWithFeedback({
      passageTitle: passage.title,
      passageText: passage.passage_text,
      passageExcerpt: buildPassageExcerptForQuestion({
        passageText: passage.passage_text,
        questionType: question.question_type,
        questionText: question.question_text,
        correctText:
          question.correct_option === 'A'
            ? question.option_a
            : question.correct_option === 'B'
              ? question.option_b
              : question.correct_option === 'C'
                ? question.option_c
                : question.option_d,
      }),
      cachedAnalysis: extractCachedChunkAnalysis(
        (generatedPassage ?? null) as Record<string, unknown> | null,
        generatedPassage?.chunk_fingerprint ?? null
      ),
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
      feedback:
        'Regenerate this question with the same question type, stronger distractor control, and fresh wording. Keep the answer choices balanced and plausible.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Regeneration failed' },
      { status: 500 },
    );
  }

  if (!generated) {
    return NextResponse.json({ error: 'No regenerated question' }, { status: 500 });
  }

  const nextVersion = Number(question.generation_version ?? 1) + 1;
  const nextQuestionType = String(question.question_type ?? '').includes('vocab')
    ? question.question_type
    : generated.question_type;

  const { data, error } = await supabase
    .from('question_bank')
    .update({
      question_type: nextQuestionType,
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
