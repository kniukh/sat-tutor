import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function normalizeItem(text: string) {
  return text.trim().toLowerCase();
}

function getItemType(text: string): 'word' | 'phrase' {
  return text.trim().includes(' ') ? 'phrase' : 'word';
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
    itemText,
    contextText,
  }: {
    studentId: string;
    lessonId: string;
    passageId: string;
    itemText: string;
    contextText?: string;
  } = body;

  const normalized = normalizeItem(itemText);

  if (!studentId || !lessonId || !passageId || !normalized) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const itemType = getItemType(normalized);
  const supabase = createServerSupabaseClient();

  const { error: captureError } = await supabase
    .from('vocabulary_capture_events')
    .insert({
      student_id: studentId,
      lesson_id: lessonId,
      passage_id: passageId,
      item_text: normalized,
      item_type: itemType,
      context_text: contextText ?? null,
    });

  if (captureError) {
    return NextResponse.json({ error: captureError.message }, { status: 500 });
  }

  const { data: existing, error: existingError } = await supabase
    .from('word_progress')
    .select('*')
    .eq('student_id', studentId)
    .eq('word', normalized)
    .eq('item_type', itemType)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (!existing) {
    const { error: insertError } = await supabase
      .from('word_progress')
      .insert({
        student_id: studentId,
        word: normalized,
        item_type: itemType,
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

  return NextResponse.json({
    success: true,
    itemType,
    itemText: normalized,
  });
}