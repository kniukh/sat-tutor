import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function normalizeItem(text: string) {
  return text.trim().toLowerCase();
}

function getNextReviewDate(daysToAdd: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const body = await request.json();

  const {
    studentId,
    lessonId,
    passageId,
    items,
  }: {
    studentId: string;
    lessonId: string;
    passageId: string;
    items: Array<{
      itemText: string;
      itemType: 'word' | 'phrase';
      contextText?: string;
    }>;
  } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'No items provided' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  for (const item of items) {
    const itemText = normalizeItem(item.itemText);

    if (!itemText) continue;

    const { error: captureError } = await supabase
      .from('vocabulary_capture_events')
      .insert({
        student_id: studentId,
        lesson_id: lessonId,
        passage_id: passageId,
        item_text: itemText,
        item_type: item.itemType,
        context_text: item.contextText ?? null,
      });

    if (captureError) {
      return NextResponse.json({ error: captureError.message }, { status: 500 });
    }

    const { data: existing, error: existingError } = await supabase
      .from('word_progress')
      .select('*')
      .eq('student_id', studentId)
      .eq('word', itemText)
      .eq('item_type', item.itemType)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (!existing) {
      const { error: insertError } = await supabase
        .from('word_progress')
        .insert({
          student_id: studentId,
          word: itemText,
          item_type: item.itemType,
          status: 'learning',
          times_seen: 1,
          times_correct: 0,
          times_wrong: 1,
          next_review_date: getNextReviewDate(1),
          source_lesson_id: lessonId,
          metadata: {},
        });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    } else {
      const { error: updateError } = await supabase
        .from('word_progress')
        .update({
          status: 'learning',
          times_seen: Number(existing.times_seen ?? 0) + 1,
          times_wrong: Number(existing.times_wrong ?? 0) + 1,
          next_review_date: getNextReviewDate(1),
          source_lesson_id: lessonId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true });
}