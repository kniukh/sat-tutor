import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { computeChunkFingerprint } from '@/services/ai/chunk-generation-cache';
import { chunkCleanChapterText, normalizeChunkPassageText } from '@/services/content/chapter-chunker';

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
    .select('id, source_type')
    .eq('id', sourceDocumentId)
    .single();

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }

  const { data: cleanRows, error: cleanError } = await supabase
    .from('source_document_clean_text')
    .select('*')
    .eq('source_document_id', sourceDocumentId)
    .order('chapter_index', { ascending: true });

  if (cleanError) {
    return NextResponse.json({ error: cleanError.message }, { status: 500 });
  }

  if (!cleanRows || cleanRows.length === 0) {
    return NextResponse.json({ error: 'No clean text found' }, { status: 400 });
  }

  const allChunks =
    source.source_type === 'poem'
      ? cleanRows.map((row: any, index: number) => ({
          chapterIndex: row.chapter_index,
          chapterTitle: row.chapter_title,
          passageText: String(row.clean_text ?? '').replace(/\r/g, '').trim(),
          wordCount: String(row.clean_text ?? '').split(/\s+/).filter(Boolean).length,
          chunkIndexWithinChapter: index,
        }))
      : cleanRows.flatMap((row: any) =>
          chunkCleanChapterText({
            chapterIndex: row.chapter_index,
            chapterTitle: row.chapter_title,
            cleanText: row.clean_text,
          }),
        );

  const { error: deleteError } = await supabase
    .from('generated_passages')
    .delete()
    .eq('source_document_id', sourceDocumentId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const rows = allChunks.map((chunk, globalIndex) => {
    const normalizedPassageText =
      source.source_type === 'poem'
        ? String(chunk.passageText ?? '').replace(/\r/g, '').trim()
        : normalizeChunkPassageText(chunk.passageText);

    return {
      source_document_id: sourceDocumentId,
      title: chunk.chapterTitle
        ? `${chunk.chapterTitle} — Part ${chunk.chunkIndexWithinChapter + 1}`
        : `Part ${globalIndex + 1}`,
      chunk_index: globalIndex,
      chapter_index: chunk.chapterIndex,
      chapter_title: chunk.chapterTitle,
      passage_text: normalizedPassageText,
      chunk_fingerprint: computeChunkFingerprint({
        passageText: normalizedPassageText,
        sourceType: source.source_type,
      }),
      word_count: normalizedPassageText.split(/\s+/).filter(Boolean).length,
      status: 'draft',
      ai_package_cache: null,
      ai_cache_version: null,
      ai_cached_at: null,
    };
  });

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from('generated_passages')
      .insert(rows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  const { error: sourceUpdateError } = await supabase
    .from('source_documents')
    .update({
      pdf_processing_status: 'chunked',
    })
    .eq('id', sourceDocumentId);

  if (sourceUpdateError) {
    return NextResponse.json({ error: sourceUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    chunksCount: rows.length,
  });
}
