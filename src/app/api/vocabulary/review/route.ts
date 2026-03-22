import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { awardStudentActivity } from '@/services/gamification/gamification.service';

function getNextReviewDate(daysToAdd: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const body = await request.json();

  const {
    wordProgressId,
    result,
  }: {
    wordProgressId: string;
    result: 'correct' | 'wrong';
  } = body;

  const supabase = createServerSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from('word_progress')
    .select('*')
    .eq('id', wordProgressId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: 'Word not found' }, { status: 404 });
  }

  const timesSeen = Number(existing.times_seen ?? 0) + 1;
  const timesCorrect =
    Number(existing.times_correct ?? 0) + (result === 'correct' ? 1 : 0);
  const timesWrong =
    Number(existing.times_wrong ?? 0) + (result === 'wrong' ? 1 : 0);

  let status = existing.status ?? 'learning';
  let nextReviewDate = getNextReviewDate(1);

  if (result === 'correct') {
    if (timesCorrect >= 5) {
      status = 'mastered';
      nextReviewDate = getNextReviewDate(14);
    } else if (timesCorrect >= 2) {
      status = 'review';
      nextReviewDate = getNextReviewDate(3);
    } else {
      status = 'learning';
      nextReviewDate = getNextReviewDate(1);
    }
  }

  if (result === 'wrong') {
    status = 'learning';
    nextReviewDate = getNextReviewDate(1);
  }

  const { data, error } = await supabase
    .from('word_progress')
    .update({
      status,
      times_seen: timesSeen,
      times_correct: timesCorrect,
      times_wrong: timesWrong,
      next_review_date: nextReviewDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wordProgressId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await awardStudentActivity({
      studentId: existing.student_id,
      xpToAdd: result === 'correct' ? 2 : 1,
    });
  } catch (gamificationError) {
    console.error('Gamification update failed:', gamificationError);
  }

  return NextResponse.json({ success: true, data });
}