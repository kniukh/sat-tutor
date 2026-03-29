import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateSatQuestionsFromPassage } from '@/services/ai/generate-sat-questions';

const TYPE_PROMPTS: Record<string, string> = {
  main_idea: 'Generate exactly 1 SAT-style main idea question.',
  detail: 'Generate exactly 1 SAT-style detail question.',
  inference: 'Generate exactly 1 SAT-style inference question.',
  vocabulary: 'Generate exactly 1 SAT-style vocabulary-in-context question.',
  tone: 'Generate exactly 1 SAT-style tone question.',
};

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

  let generated;
  try {
    const base = await generateSatQuestionsFromPassage({
      title: passage.title,
      passageText: `${TYPE_PROMPTS[question.question_type] ?? ''}\n\n${passage.passage_text}`,
    });

    generated = base.find((item) => item.question_type === question.question_type) ?? base[0];
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
