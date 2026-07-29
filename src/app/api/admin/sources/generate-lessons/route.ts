import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAiLessonFromGeneratedPassage } from '@/services/content/create-ai-lesson-from-generated-passage.service';
import { isAdminApiAuthError, requireAdminApi } from '@/lib/auth/admin';

export async function GET(request: Request) {
  try {
    await requireAdminApi();
  } catch (error) {
    if (isAdminApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const sourceDocumentId = new URL(request.url).searchParams.get('sourceDocumentId');
  if (!sourceDocumentId) {
    return NextResponse.json({ error: 'sourceDocumentId is required' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('generated_passages')
    .select('id, lesson_id, chunk_index, title')
    .eq('source_document_id', sourceDocumentId)
    .order('chunk_index', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    pending: (data ?? []).filter((item) => !item.lesson_id),
  });
}

export async function POST(request: Request) {
  try {
    await requireAdminApi();
  } catch (error) {
    if (isAdminApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const body = await request.json();
  const { sourceDocumentId, unitId, generatedPassageId } = body as {
    sourceDocumentId: string;
    unitId: string;
    generatedPassageId?: string;
  };

  if (!sourceDocumentId || !unitId) {
    return NextResponse.json(
      { error: 'sourceDocumentId and unitId are required' },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();

  const { data: passages, error: passagesError } = await supabase
    .from('generated_passages')
    .select('id, lesson_id')
    .eq('source_document_id', sourceDocumentId)
    .order('chunk_index', { ascending: true });

  if (passagesError) {
    return NextResponse.json({ error: passagesError.message }, { status: 500 });
  }

  const candidates = (passages ?? []).filter(
    (item) =>
      !item.lesson_id && (!generatedPassageId || item.id === generatedPassageId)
  );

  if (generatedPassageId && candidates.length === 0) {
    return NextResponse.json({
      success: true,
      createdCount: 0,
      failedCount: 0,
      skippedCount: 1,
      lessonIds: [],
      failed: [],
    });
  }

  const createdLessons: Array<{ id: string }> = [];
  const failed: Array<{ passageId: string; error: string }> = [];

  for (const passage of candidates) {
    try {
      const lesson = await createAiLessonFromGeneratedPassage({
        generatedPassageId: passage.id,
        unitId,
      });
      createdLessons.push({ id: String(lesson.id) });
    } catch (error: unknown) {
      failed.push({
        passageId: passage.id,
        error: error instanceof Error ? error.message : 'Failed to generate lesson',
      });
    }
  }

  return NextResponse.json({
    success: failed.length === 0,
    createdCount: createdLessons.length,
    failedCount: failed.length,
    skippedCount: (passages ?? []).length - candidates.length,
    lessonIds: createdLessons.map((lesson) => lesson.id),
    failed,
  });
}
