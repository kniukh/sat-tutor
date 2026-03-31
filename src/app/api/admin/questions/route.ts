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

export async function PATCH(request: Request) {
  const body = await request.json();
  const {
    questionId,
    questionType,
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    explanation = '',
    displayOrder,
  } = body;

  if (!questionId) {
    return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof questionType === 'string') updates.question_type = questionType;
  if (typeof questionText === 'string') updates.question_text = questionText;
  if (typeof optionA === 'string') updates.option_a = optionA;
  if (typeof optionB === 'string') updates.option_b = optionB;
  if (typeof optionC === 'string') updates.option_c = optionC;
  if (typeof optionD === 'string') updates.option_d = optionD;
  if (typeof correctOption === 'string') updates.correct_option = correctOption;
  if (typeof explanation === 'string') updates.explanation = explanation;
  if (typeof displayOrder === 'number' && Number.isFinite(displayOrder)) {
    updates.display_order = displayOrder;
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('question_bank')
    .update(updates)
    .eq('id', questionId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
