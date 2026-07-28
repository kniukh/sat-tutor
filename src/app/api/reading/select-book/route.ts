import { NextResponse } from 'next/server';
import { isStudentApiAuthError, requireStudentApiStudentId } from '@/lib/auth/student-api';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Failed to select book';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requestedStudentId = String(body?.studentId || '');
    const sourceDocumentId = String(body?.sourceDocumentId || '');

    if (!sourceDocumentId) {
      return NextResponse.json({ error: 'sourceDocumentId is required' }, { status: 400 });
    }

    const studentId = await requireStudentApiStudentId(requestedStudentId);
    const supabase = await createServerSupabaseClient();
    const { data: book, error: bookError } = await supabase
      .from('source_documents')
      .select('id')
      .eq('id', sourceDocumentId)
      .eq('source_type', 'book')
      .maybeSingle();

    if (bookError || !book) {
      return NextResponse.json({ error: bookError?.message ?? 'Book not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { data: existing, error: existingError } = await supabase
      .from('student_book_progress')
      .select('id')
      .eq('student_id', studentId)
      .eq('source_document_id', sourceDocumentId)
      .maybeSingle();

    if (existingError) throw existingError;

    const operation = existing
      ? supabase.from('student_book_progress').update({ last_opened_at: now, updated_at: now }).eq('id', existing.id)
      : supabase.from('student_book_progress').insert({
          student_id: studentId,
          source_document_id: sourceDocumentId,
          last_opened_at: now,
          completed_lessons_count: 0,
          total_lessons_count: 0,
          progress_percent: 0,
        });
    const { error } = await operation;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
