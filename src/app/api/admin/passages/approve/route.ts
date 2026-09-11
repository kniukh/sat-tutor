import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isAdminApiAuthError, requireAdminApi } from '@/lib/auth/admin';

export async function POST(request: Request) {
  try {
    await requireAdminApi();
  } catch (error) {
    if (isAdminApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const body = await request.json();
  const { generatedPassageId, status } = body;

  if (!generatedPassageId || !['draft', 'review', 'approved', 'published'].includes(status)) {
    return NextResponse.json({ error: 'generatedPassageId and a valid status are required' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  if (status === 'published') {
    const { data: passage, error: passageError } = await supabase
      .from('generated_passages')
      .select('passage_text, lesson_id, content_mode')
      .eq('id', generatedPassageId)
      .single();
    if (passageError || !passage) {
      return NextResponse.json({ error: passageError?.message ?? 'Passage not found' }, { status: 404 });
    }
    const wordCount = String(passage.passage_text ?? '').split(/\s+/).filter(Boolean).length;
    if (passage.content_mode === 'det' && (!passage.lesson_id || wordCount < 20 || !/[.!?][\"']?$/.test(String(passage.passage_text).trim()))) {
      return NextResponse.json({ error: 'DET chunk needs a lesson, at least 20 words, and a complete final sentence before publishing' }, { status: 400 });
    }
  }

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
