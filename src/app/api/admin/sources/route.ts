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
  async function searchOpenLibrary(params: Record<string, string>) {
    const query = new URLSearchParams({
      limit: '5',
      ...params,
    });

    const response = await fetch(`https://openlibrary.org/search.json?${query.toString()}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return [];
    }

    const json = await response.json();
    return Array.isArray(json?.docs) ? json.docs : [];
  }

  function getDocCoverUrl(doc: any) {
    if (!doc || typeof doc !== 'object') {
      return null;
    }

    if (doc.cover_i) {
      return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    }

    if (typeof doc.cover_edition_key === 'string' && doc.cover_edition_key.trim()) {
      return `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key.trim()}-L.jpg`;
    }

    if (Array.isArray(doc.edition_key) && typeof doc.edition_key[0] === 'string') {
      return `https://covers.openlibrary.org/b/olid/${doc.edition_key[0]}-L.jpg`;
    }

    if (Array.isArray(doc.isbn) && typeof doc.isbn[0] === 'string') {
      return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
    }

    return null;
  }

  function normalize(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function scoreDoc(doc: any, expectedTitle: string, expectedAuthor: string) {
    let score = 0;
    const normalizedTitle = normalize(String(doc?.title ?? ''));
    const normalizedAuthor = normalize(
      Array.isArray(doc?.author_name) ? String(doc.author_name[0] ?? '') : String(doc?.author_name ?? ''),
    );

    if (normalizedTitle === expectedTitle) score += 5;
    else if (normalizedTitle.includes(expectedTitle) || expectedTitle.includes(normalizedTitle)) score += 3;

    if (expectedAuthor) {
      if (normalizedAuthor === expectedAuthor) score += 4;
      else if (normalizedAuthor.includes(expectedAuthor) || expectedAuthor.includes(normalizedAuthor)) score += 2;
    }

    if (doc?.cover_i || doc?.cover_edition_key || (Array.isArray(doc?.edition_key) && doc.edition_key.length > 0)) {
      score += 2;
    }

    return score;
  }

  try {
    const expectedTitle = normalize(title);
    const expectedAuthor = normalize(author);

    const searchVariants = [
      { title, author },
      { title },
      { q: author ? `${title} ${author}` : title },
    ];

    for (const variant of searchVariants) {
      const docs = await searchOpenLibrary(
        Object.fromEntries(
          Object.entries(variant).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
        ),
      );

      const bestDoc = docs
        .map((doc) => ({
          doc,
          coverUrl: getDocCoverUrl(doc),
          score: scoreDoc(doc, expectedTitle, expectedAuthor),
        }))
        .filter((item) => Boolean(item.coverUrl))
        .sort((a, b) => b.score - a.score)[0];

      if (bestDoc?.coverUrl) {
        return bestDoc.coverUrl;
      }
    }
  } catch {
    return null;
  }

  return null;
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

export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient();

  try {
    const body = await request.json();
    const sourceId = String(body?.sourceId || '').trim();
    const action = String(body?.action || '').trim();

    if (!sourceId) {
      return NextResponse.json({ error: 'sourceId is required' }, { status: 400 });
    }

    if (action !== 'refresh_cover') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    const { data: source, error: sourceError } = await supabase
      .from('source_documents')
      .select('id, title, author, source_type, metadata')
      .eq('id', sourceId)
      .single();

    if (sourceError || !source) {
      return NextResponse.json({ error: sourceError?.message ?? 'Source not found' }, { status: 404 });
    }

    if (source.source_type !== 'book') {
      return NextResponse.json({ error: 'Cover refresh is only available for books' }, { status: 400 });
    }

    const coverImagePath = await fetchCoverUrl(String(source.title ?? ''), String(source.author ?? ''));
    const metadata =
      source.metadata && typeof source.metadata === 'object' && !Array.isArray(source.metadata)
        ? source.metadata
        : {};

    const { error: updateError } = await supabase
      .from('source_documents')
      .update({
        metadata: {
          ...metadata,
          cover_image_path: coverImagePath,
        },
      })
      .eq('id', sourceId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      coverImagePath,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to refresh cover' },
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
