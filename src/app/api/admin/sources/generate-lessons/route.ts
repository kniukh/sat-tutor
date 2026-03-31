import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAiLessonFromGeneratedPassage } from '@/services/content/create-ai-lesson-from-generated-passage.service';

export async function POST(request: Request) {
  const body = await request.json();
  const { sourceDocumentId, unitId } = body as {
    sourceDocumentId: string;
    unitId: string;
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

  const candidates = (passages ?? []).filter((item: any) => !item.lesson_id);

  try {
    const createdLessons = [];

    for (const passage of candidates) {
      const lesson = await createAiLessonFromGeneratedPassage({
        generatedPassageId: passage.id,
        unitId,
      });
      createdLessons.push(lesson);
    }

    return NextResponse.json({
      success: true,
      createdCount: createdLessons.length,
      lessonIds: createdLessons.map((lesson: any) => lesson.id),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to generate lessons' },
      { status: 500 },
    );
  }
}
