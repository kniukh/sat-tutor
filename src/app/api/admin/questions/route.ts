import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json();

  const {
    lessonId,
    questionType,
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    explanation = '',
    displayOrder = 1,
  } = body;

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('question_bank')
    .insert({
      lesson_id: lessonId,
      question_type: questionType,
      question_text: questionText,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      correct_option: correctOption,
      explanation,
      display_order: displayOrder,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
