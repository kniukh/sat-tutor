import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isAdminApiAuthError, requireAdminApi } from '@/lib/auth/admin';

export async function PATCH(request: Request) {
  try {
    await requireAdminApi();
    const body = await request.json();
    const passageId = String(body?.passageId ?? '').trim();
    const passageText = String(body?.passageText ?? '').replace(/\r/g, '').trim();

    if (!passageId || !passageText) {
      return NextResponse.json({ error: 'passageId and passageText are required' }, { status: 400 });
    }

    const wordCount = passageText.split(/\s+/).filter(Boolean).length;
    if (wordCount < 20) {
      return NextResponse.json({ error: 'Chunk must contain at least 20 words' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('generated_passages')
      .update({
        passage_text: passageText,
        word_count: wordCount,
        status: 'review',
        ai_package_cache: null,
        ai_cache_version: null,
        ai_cached_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', passageId)
      .select('id, passage_text, word_count, status')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Failed to update chunk' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (isAdminApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update chunk' }, { status: 500 });
  }
}
