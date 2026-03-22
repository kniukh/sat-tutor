import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { vocabularyItemId, isUnderstood } = body as {
    vocabularyItemId: string;
    isUnderstood: boolean;
  };

  if (!vocabularyItemId) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('vocabulary_item_details')
    .update({
      is_understood: Boolean(isUnderstood),
    })
    .eq('id', vocabularyItemId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}