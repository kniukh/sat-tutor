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

  const supabase = await createServerSupabaseClient();

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

export async function PATCH(request: Request) {
  const body = await request.json();
  const { passageId, title = '', passageText, passageKind, displayOrder } = body;

  if (!passageId) {
    return NextResponse.json({ error: 'passageId is required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof title === 'string') updates.title = title;
  if (typeof passageText === 'string') updates.passage_text = passageText;
  if (typeof passageKind === 'string') updates.passage_kind = passageKind;
  if (typeof displayOrder === 'number' && Number.isFinite(displayOrder)) {
    updates.display_order = displayOrder;
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('lesson_passages')
    .update(updates)
    .eq('id', passageId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
