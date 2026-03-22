import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json();

  const {
    lessonId,
    title = '',
    passageText,
    passageKind = 'prose',
    displayOrder = 1,
  } = body;

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('lesson_passages')
    .insert({
      lesson_id: lessonId,
      title,
      passage_text: passageText,
      passage_kind: passageKind,
      display_order: displayOrder,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}