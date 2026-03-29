import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function POST(request: Request) {
  const body = await request.json();
  const { generatedPassageId, unitId } = body;

  const supabase = await createServerSupabaseClient();

  const { data: passage, error: passageError } = await supabase
    .from('generated_passages')
    .select('*')
    .eq('id', generatedPassageId)
    .single();

  if (passageError || !passage) {
    return NextResponse.json({ error: 'Generated passage not found' }, { status: 404 });
  }

  const baseName = passage.title || `Generated Passage ${passage.chunk_index + 1}`;
  const lessonName = baseName;
  const lessonSlug = `${makeSlug(baseName)}-${Date.now()}`;

  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .insert({
      unit_id: unitId,
      name: lessonName,
      slug: lessonSlug,
      lesson_type: 'reading_vocab',
      status: 'draft',
      is_active: true,
      display_order: 0,
    })
    .select()
    .single();

  if (lessonError || !lesson) {
    return NextResponse.json({ error: lessonError?.message ?? 'Lesson create failed' }, { status: 500 });
  }

  const { error: lessonPassageError } = await supabase
    .from('lesson_passages')
    .insert({
      lesson_id: lesson.id,
      title: passage.title || null,
      passage_text: passage.passage_text,
      passage_kind: 'prose',
      word_count: passage.word_count ?? null,
      is_primary: true,
      display_order: 1,
    });

  if (lessonPassageError) {
    return NextResponse.json({ error: lessonPassageError.message }, { status: 500 });
  }

  const { error: updateGeneratedError } = await supabase
    .from('generated_passages')
    .update({
      status: 'approved',
      lesson_id: lesson.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', generatedPassageId);

  if (updateGeneratedError) {
    return NextResponse.json({ error: updateGeneratedError.message }, { status: 500 });
  }

  return NextResponse.json({ data: lesson });
}
