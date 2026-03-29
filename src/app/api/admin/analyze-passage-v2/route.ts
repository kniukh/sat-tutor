import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { analyzeGeneratedPassageV2 } from '@/services/ai/analyze-generated-passage-v2';

export async function POST(request: Request) {
  const body = await request.json();
  const { generatedPassageId } = body as {
    generatedPassageId: string;
  };

  const supabase = await createServerSupabaseClient();

  const { data: passage, error: passageError } = await supabase
    .from('generated_passages')
    .select('*')
    .eq('id', generatedPassageId)
    .single();

  if (passageError || !passage) {
    return NextResponse.json({ error: 'Generated passage not found' }, { status: 404 });
  }

  let analysis;
  try {
    analysis = await analyzeGeneratedPassageV2({
      title: passage.title,
      chapterTitle: passage.chapter_title,
      passageText: passage.passage_text,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Passage analysis failed' },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from('generated_passages')
    .update({
      passage_role: analysis.passage_role,
      question_strategy: analysis.question_strategy,
      recommended_question_count: analysis.recommended_question_count,
      recommended_question_types: analysis.recommended_question_types,
      analyzer_reason: analysis.analyzer_reason,
      difficulty_level: analysis.difficulty_level,
      text_mode: analysis.text_mode,
      vocab_density: analysis.vocab_density,
      phrase_density: analysis.phrase_density,
      writing_prompt_worthy: analysis.writing_prompt_worthy,
      recommended_vocab_questions_count: analysis.recommended_vocab_questions_count,
      recommended_vocab_target_words: analysis.recommended_vocab_target_words,
      recommended_vocab_target_phrases: analysis.recommended_vocab_target_phrases,
      updated_at: new Date().toISOString(),
    })
    .eq('id', generatedPassageId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
