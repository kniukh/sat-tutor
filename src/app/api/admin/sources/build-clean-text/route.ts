import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { buildCleanBookText } from '@/services/pdf/build-clean-book-text';

export async function POST(request: Request) {
  const body = await request.json();
  const { sourceDocumentId } = body as {
    sourceDocumentId: string;
  };

  if (!sourceDocumentId) {
    return NextResponse.json({ error: 'sourceDocumentId is required' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: structure, error: structureError } = await supabase
    .from('source_document_structure')
    .select('*')
    .eq('source_document_id', sourceDocumentId)
    .single();

  if (structureError || !structure) {
    return NextResponse.json({ error: 'Source structure not found' }, { status: 404 });
  }

  const { data: pages, error: pagesError } = await supabase
    .from('source_document_pages')
    .select('*')
    .eq('source_document_id', sourceDocumentId)
    .order('page_number', { ascending: true });

  if (pagesError) {
    return NextResponse.json({ error: pagesError.message }, { status: 500 });
  }

  if (!pages || pages.length === 0) {
    return NextResponse.json({ error: 'No pages found' }, { status: 400 });
  }

  const cleanedChapters = buildCleanBookText({
    pages: pages.map((p) => ({
      page_number: p.page_number,
      raw_text: p.raw_text,
    })),
    bodyStartPage: structure.body_start_page,
    bodyEndPage: structure.body_end_page,
    chapters: Array.isArray(structure.detected_chapters_json)
      ? structure.detected_chapters_json
      : [],
  });

  const { error: deleteError } = await supabase
    .from('source_document_clean_text')
    .delete()
    .eq('source_document_id', sourceDocumentId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (cleanedChapters.length > 0) {
    const rows = cleanedChapters.map((chapter) => ({
      source_document_id: sourceDocumentId,
      chapter_index: chapter.chapter_index,
      chapter_title: chapter.chapter_title,
      clean_text: chapter.clean_text,
    }));

    const { error: insertError } = await supabase
      .from('source_document_clean_text')
      .insert(rows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  const { error: sourceUpdateError } = await supabase
    .from('source_documents')
    .update({
      pdf_processing_status: 'cleaned',
    })
    .eq('id', sourceDocumentId);

  if (sourceUpdateError) {
    return NextResponse.json({ error: sourceUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    chaptersCount: cleanedChapters.length,
  });
}