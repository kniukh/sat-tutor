import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json();

  const { title, author = '', sourceType = 'book', rawText } = body;

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('source_documents')
    .insert({
      title,
      author,
      source_type: sourceType,
      raw_text: rawText,
      metadata: {},
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  // Delete related records first
  await supabase.from('generated_passages').delete().eq('source_document_id', id);
  await supabase.from('source_document_pages').delete().eq('source_document_id', id);
  await supabase.from('source_document_structure').delete().eq('source_document_id', id);
  await supabase.from('source_document_clean_text').delete().eq('source_document_id', id);

  // Then delete the source
  const { error } = await supabase
    .from('source_documents')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}