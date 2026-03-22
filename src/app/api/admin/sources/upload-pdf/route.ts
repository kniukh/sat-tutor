import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { extractPdfPages } from '@/services/pdf/extract-pdf-pages';

function safeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const title = String(formData.get('title') || '').trim();
    const author = String(formData.get('author') || '').trim();
    const file = formData.get('file');

    if (!title || !(file instanceof File)) {
      return NextResponse.json({ error: 'Title and PDF file are required' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'books');
    await fs.mkdir(uploadDir, { recursive: true });

    const baseName = safeSlug(title) || 'book';
    const fileName = `${Date.now()}-${baseName}.pdf`;
    const fullPath = path.join(uploadDir, fileName);
    const publicPath = `/uploads/books/${fileName}`;

    await fs.writeFile(fullPath, buffer);

    const supabase = createServerSupabaseClient();

    const { data: sourceDocument, error: sourceError } = await supabase
      .from('source_documents')
      .insert({
        title,
        author: author || null,
        source_type: 'book',
        raw_text: '',
        upload_kind: 'pdf',
        pdf_file_path: publicPath,
        pdf_processing_status: 'uploaded',
      })
      .select()
      .single();

    if (sourceError || !sourceDocument) {
      return NextResponse.json(
        { error: sourceError?.message ?? 'Failed to create source document' },
        { status: 500 },
      );
    }

    let pages;
    try {
      pages = await extractPdfPages(fullPath);
    } catch (error: any) {
      await supabase
        .from('source_documents')
        .update({
          pdf_processing_status: 'failed',
        })
        .eq('id', sourceDocument.id);

      return NextResponse.json(
        { error: error?.message ?? 'PDF extraction failed' },
        { status: 500 },
      );
    }

    if (pages.length > 0) {
      const rows = pages.map((page) => ({
        source_document_id: sourceDocument.id,
        page_number: page.pageNumber,
        raw_text: page.rawText,
      }));

      const { error: pagesError } = await supabase
        .from('source_document_pages')
        .insert(rows);

      if (pagesError) {
        await supabase
          .from('source_documents')
          .update({
            pdf_processing_status: 'failed',
          })
          .eq('id', sourceDocument.id);

        return NextResponse.json({ error: pagesError.message }, { status: 500 });
      }
    }

    const combinedText = pages.map((p) => p.rawText).join('\n\n');

    const { error: updateError } = await supabase
      .from('source_documents')
      .update({
        raw_text: combinedText,
        pdf_processing_status: 'pages_extracted',
      })
      .eq('id', sourceDocument.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sourceDocumentId: sourceDocument.id,
      pagesCount: pages.length,
    });
  } catch (error: any) {
    console.error('Upload PDF error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Upload failed' },
      { status: 500 },
    );
  }
}