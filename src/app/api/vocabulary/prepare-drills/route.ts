import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  auditVocabularyDistractors,
  prepareVocabularyDistractors,
} from '@/services/vocabulary/distractor-quality.service';

export async function POST(request: Request) {
  const body = await request.json();
  const { studentId } = body as { studentId: string };

  if (!studentId) {
    return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const today = new Date().toISOString().slice(0, 10);

  const { data: items, error } = await supabase
    .from('vocabulary_item_details')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const meaningPool = (items ?? [])
    .map((item) => item.english_explanation)
    .filter((value): value is string => Boolean(value));

  for (const item of items ?? []) {
    const audit = auditVocabularyDistractors({
      correctAnswer: item.english_explanation ?? '',
      distractors: Array.isArray(item.distractors) ? item.distractors : [],
      itemType: (item.item_type ?? 'word') as 'word' | 'phrase',
    });

    try {
      const distractors = await prepareVocabularyDistractors({
        itemText: item.item_text,
        itemType: (item.item_type ?? 'word') as 'word' | 'phrase',
        correctAnswer: item.english_explanation ?? '',
        contextSentence: item.context_sentence ?? null,
        exampleText: item.example_text ?? null,
        existingDistractors: Array.isArray(item.distractors) ? item.distractors : [],
        fallbackPool: meaningPool.filter(
          (candidate) =>
            candidate.trim().toLowerCase() !==
            String(item.english_explanation ?? '').trim().toLowerCase()
        ),
      });

      const nextDistractors =
        distractors.length >= 3 ? distractors : audit.normalizedDistractors;

      if (
        !audit.needsRefinement &&
        Array.isArray(item.distractors) &&
        JSON.stringify(item.distractors) === JSON.stringify(nextDistractors)
      ) {
        continue;
      }

      const { error: updateError } = await supabase
        .from('vocabulary_item_details')
        .update({
          distractors: nextDistractors,
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
