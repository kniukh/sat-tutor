import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isAdminApiAuthError, requireAdminApi } from '@/lib/auth/admin';

export async function POST(request: Request) {
  try {
    await requireAdminApi();
    const body = await request.json();
    const studentId = String(body?.studentId ?? '').trim();
    const sourceDocumentId = String(body?.sourceDocumentId ?? '').trim();
    const chapterIndex = Number(body?.chapterIndex);
    if (!studentId || !sourceDocumentId || !Number.isInteger(chapterIndex) || chapterIndex < 0) {
      return NextResponse.json({ error: 'studentId, sourceDocumentId, and chapterIndex are required' }, { status: 400 });
    }
    const supabase = await createServerSupabaseClient();
    const [{ data: student }, { data: source }] = await Promise.all([
      supabase.from('students').select('id').eq('id', studentId).eq('is_active', true).maybeSingle(),
      supabase.from('source_documents').select('id, content_mode').eq('id', sourceDocumentId).eq('source_type', 'book').maybeSingle(),
    ]);
    if (!student || !source) return NextResponse.json({ error: 'Active student or book not found' }, { status: 404 });
    const { data: chapter } = await supabase
      .from('source_document_clean_text')
      .select('chapter_index, chapter_title')
      .eq('source_document_id', sourceDocumentId)
      .eq('chapter_index', chapterIndex)
      .maybeSingle();
    if (!chapter) return NextResponse.json({ error: 'Chapter not found for this book' }, { status: 404 });

    const { data: existing } = await supabase
      .from('reading_assignments')
      .select('id')
      .eq('student_id', studentId)
      .eq('source_document_id', sourceDocumentId)
      .eq('chapter_index', chapterIndex)
      .maybeSingle();

    const payload = {
      student_id: studentId,
      source_document_id: sourceDocumentId,
      chapter_index: chapterIndex,
      assigned_by: 'admin',
      status: 'assigned',
      completed_at: null,
      vocabulary_checkpoints_completed: 0,
    };
    const query = existing
      ? supabase.from('reading_assignments').update(payload).eq('id', existing.id).select().single()
      : supabase.from('reading_assignments').insert(payload).select().single();
    if (existing) {
      const { error: resetVocabularyError } = await supabase
        .from('reading_assignment_vocabulary')
        .delete()
        .eq('assignment_id', existing.id);
      if (resetVocabularyError) {
        return NextResponse.json({ error: resetVocabularyError.message }, { status: 500 });
      }
    }
    const { data, error } = await query;
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to assign book' }, { status: 500 });
    return NextResponse.json({ data });
  } catch (error) {
    if (isAdminApiAuthError(error)) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to assign book' }, { status: 500 });
  }
}
