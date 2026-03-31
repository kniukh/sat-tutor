import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type ChapterPayload = {
  number?: number;
  name?: string;
  text?: string;
};

function safeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function saveCoverFile(file: File, title: string) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'covers');
  await fs.mkdir(uploadDir, { recursive: true });

  const baseName = safeSlug(title) || 'cover';
  const extension = path.extname(file.name || '') || '.jpg';
  const fileName = `${Date.now()}-${baseName}${extension}`;
  const fullPath = path.join(uploadDir, fileName);
  const publicPath = `/uploads/covers/${fileName}`;

  await fs.writeFile(fullPath, buffer);
  return publicPath;
}

async function fetchCoverUrl(title: string, author: string) {
  try {
    const params = new URLSearchParams({
      title,
      author,
      limit: '1',
    });

    const response = await fetch(`https://openlibrary.org/search.json?${params.toString()}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const firstDoc = Array.isArray(json?.docs) ? json.docs[0] : null;
    const coverId = firstDoc?.cover_i;

    if (!coverId) {
      return null;
    }

    return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
  } catch {
    return null;
  }
}

function normalizeManualRows(params: {
  sourceType: string;
  title: string;
  rawText: string;
  chapters: ChapterPayload[];
}) {
  if (params.sourceType === 'book') {
    return params.chapters
      .filter((chapter) => String(chapter.text ?? '').trim().length > 0)
      .map((chapter, index) => ({
        chapter_index: Number(chapter.number ?? index + 1),
        chapter_title: String(chapter.name ?? '').trim() || `Chapter ${index + 1}`,
        clean_text: String(chapter.text ?? '').trim(),
      }));
  }

  if (!params.rawText.trim()) {
    return [];
  }

  return [
    {
      chapter_index: 1,
      chapter_title: params.title,
      clean_text: params.rawText.trim(),
    },
  ];
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  const supabase = await createServerSupabaseClient();

  try {
    let title = '';
    let author = '';
    let sourceType = 'book';
    let rawText = '';
    let coverMode = 'none';
    let coverFile: File | null = null;
    let chapters: ChapterPayload[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      title = String(formData.get('title') || '').trim();
      author = String(formData.get('author') || '').trim();
      sourceType = String(formData.get('sourceType') || 'book').trim();
      rawText = String(formData.get('rawText') || '');
      coverMode = String(formData.get('coverMode') || 'none').trim();
      coverFile = formData.get('coverFile') instanceof File ? (formData.get('coverFile') as File) : null;
      const chaptersJson = String(formData.get('chaptersJson') || '[]');
      chapters = JSON.parse(chaptersJson);
    } else {
      const body = await request.json();
      title = String(body.title || '').trim();
      author = String(body.author || '').trim();
      sourceType = String(body.sourceType || 'book').trim();
      rawText = String(body.rawText || '');
      coverMode = String(body.coverMode || 'none').trim();
      chapters = Array.isArray(body.chapters) ? body.chapters : [];
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const cleanRows = normalizeManualRows({
      sourceType,
      title,
      rawText,
      chapters,
    });

    if (cleanRows.length === 0) {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
    }

    const combinedRawText =
      sourceType === 'book'
        ? cleanRows.map((row) => row.clean_text).join('\n\n')
        : cleanRows[0]?.clean_text ?? '';

    let coverImagePath: string | null = null;
    if (sourceType === 'book' && coverMode === 'upload' && coverFile) {
      coverImagePath = await saveCoverFile(coverFile, title);
    } else if (sourceType === 'book' && coverMode === 'auto') {
      coverImagePath = await fetchCoverUrl(title, author);
    }

    const { data, error } = await supabase
      .from('source_documents')
      .insert({
        title,
        author: author || null,
        source_type: sourceType,
        raw_text: combinedRawText,
        upload_kind: 'raw_text',
        pdf_processing_status: 'cleaned',
        metadata: {
          cover_image_path: coverImagePath,
          content_kind: sourceType,
          poem_mode: sourceType === 'poem',
          chapter_count: cleanRows.length,
        },
      })
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? 'Failed to create source' },
        { status: 500 },
      );
    }

    const rows = cleanRows.map((row) => ({
      source_document_id: data.id,
      chapter_index: row.chapter_index,
      chapter_title: row.chapter_title,
      clean_text: row.clean_text,
    }));

    if (rows.length > 0) {
      const { error: cleanTextError } = await supabase
        .from('source_document_clean_text')
        .insert(rows);

      if (cleanTextError) {
        return NextResponse.json({ error: cleanTextError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create source' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  await supabase.from('generated_passages').delete().eq('source_document_id', id);
  await supabase.from('source_document_pages').delete().eq('source_document_id', id);
  await supabase.from('source_document_structure').delete().eq('source_document_id', id);
  await supabase.from('source_document_clean_text').delete().eq('source_document_id', id);

  const { error } = await supabase
    .from('source_documents')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
