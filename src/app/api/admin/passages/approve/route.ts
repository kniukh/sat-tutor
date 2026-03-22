import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { generatedPassageId, status } = body;

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('generated_passages')
    .update({
      status,
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