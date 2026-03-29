import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { detectBookStructure } from '@/services/ai/detect-book-structure';

export async function POST(request: Request) {
  const body = await request.json();
  const { sourceDocumentId } = body as {
    sourceDocumentId: string;
  };

  if (!sourceDocumentId) {
    return NextResponse.json({ error: 'sourceDocumentId is required' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data: source, error: sourceError } = await supabase
    .from('source_documents')
    .select('*')
    .eq('id', sourceDocumentId)
    .single();

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Source document not found' }, { status: 404 });
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
    return NextResponse.json({ error: 'No extracted pages found' }, { status: 400 });
  }

  let structure;
  try {
    structure = await detectBookStructure({
      title: source.title,
      author: source.author,
      pages: pages.map((p) => ({
        page_number: p.page_number,
        raw_text: p.raw_text,
      })),
    });
  } catch (error: any) {
    await supabase
      .from('source_documents')
      .update({
        pdf_processing_status: 'failed',
      })
      .eq('id', sourceDocumentId);

    return NextResponse.json(
      { error: error?.message ?? 'Structure detection failed' },
      { status: 500 },
    );
  }

  const { data: existing } = await supabase
    .from('source_document_structure')
    .select('*')
    .eq('source_document_id', sourceDocumentId)
    .maybeSingle();

  if (existing) {
    const { error: updateError } = await supabase
      .from('source_document_structure')
      .update({
        front_matter_end_page: structure.front_matter_end_page,
        body_start_page: structure.body_start_page,
        body_end_page: structure.body_end_page,
        detected_chapters_json: structure.detected_chapters_json,
        excluded_sections_json: structure.excluded_sections_json,
        cleaning_notes: structure.cleaning_notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  } else {
    const { error: insertError } = await supabase
      .from('source_document_structure')
      .insert({
        source_document_id: sourceDocumentId,
        front_matter_end_page: structure.front_matter_end_page,
        body_start_page: structure.body_start_page,
        body_end_page: structure.body_end_page,
        detected_chapters_json: structure.detected_chapters_json,
        excluded_sections_json: structure.excluded_sections_json,
        cleaning_notes: structure.cleaning_notes,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  const { error: sourceUpdateError } = await supabase
    .from('source_documents')
    .update({
      pdf_processing_status: 'structured',
    })
    .eq('id', sourceDocumentId);

  if (sourceUpdateError) {
    return NextResponse.json({ error: sourceUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: structure });
}
