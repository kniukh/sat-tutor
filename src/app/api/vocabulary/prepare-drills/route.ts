import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateVocabularyDrillOptions } from '@/services/ai/generate-vocabulary-drill-options';

export async function POST(request: Request) {
  const body = await request.json();
  const { studentId } = body as { studentId: string };

  if (!studentId) {
    return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const today = new Date().toISOString().slice(0, 10);

  const { data: items, error } = await supabase
    .from('vocabulary_item_details')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const item of items ?? []) {
    if (Array.isArray(item.distractors) && item.distractors.length >= 3) {
      continue;
    }

    try {
      const generated = await generateVocabularyDrillOptions({
        itemText: item.item_text,
        itemType: item.item_type,
        plainEnglishMeaning: item.english_explanation ?? '',
      });

      const { error: updateError } = await supabase
        .from('vocabulary_item_details')
        .update({
          distractors: generated.distractors,
        })
        .eq('id', item.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message ?? 'Failed to prepare drills' },
        { status: 500 },
      );
    }
  }

  const { data: dueWords, error: dueError } = await supabase
    .from('word_progress')
    .select('*')
    .eq('student_id', studentId)
    .lte('next_review_date', today)
    .order('next_review_date', { ascending: true });

  if (dueError) {
    return NextResponse.json({ error: dueError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: dueWords?.length ?? 0 });
}