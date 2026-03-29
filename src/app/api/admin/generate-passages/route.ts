import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function splitIntoParagraphChunks(rawText: string, targetWords = 350) {
  const paragraphs = rawText
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentWords = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean).length;

    if (currentWords + words > targetWords && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n\n'));
      currentChunk = [paragraph];
      currentWords = words;
    } else {
      currentChunk.push(paragraph);
      currentWords += words;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }

  return chunks;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { sourceId } = body;

  const supabase = await createServerSupabaseClient();

  const { data: source, error: sourceError } = await supabase
    .from('source_documents')
    .select('*')
    .eq('id', sourceId)
    .single();

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from('generated_passages')
    .delete()
    .eq('source_document_id', sourceId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const chunks = splitIntoParagraphChunks(source.raw_text, 350);

  if (chunks.length === 0) {
    return NextResponse.json({ error: 'No chunks generated' }, { status: 400 });
  }

  const rows = chunks.map((chunk, index) => ({
    source_document_id: sourceId,
    title: null,
    passage_text: chunk,
    chunk_index: index,
    word_count: chunk.split(/\s+/).filter(Boolean).length,
    status: 'draft',
    metadata: {},
  }));

  const { data, error } = await supabase
    .from('generated_passages')
    .insert(rows)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
