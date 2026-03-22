import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { questionId, reviewStatus } = body;

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('question_bank')
    .update({
      review_status: reviewStatus,
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