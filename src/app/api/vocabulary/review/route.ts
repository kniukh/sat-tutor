import { NextResponse } from 'next/server';
import { isStudentApiAuthError, requireStudentApiSession } from "@/lib/auth/student-api";
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { awardStudentActivity } from '@/services/gamification/gamification.service';
import { evaluateReviewPolicy } from '@/services/vocabulary/review-policy.service';

export async function POST(request: Request) {
  const body = await request.json();

  const {
    wordProgressId,
    result,
  }: {
    wordProgressId: string;
    result: 'correct' | 'wrong';
  } = body;

  const supabase = await createServerSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from('word_progress')
    .select('*')
    .eq('id', wordProgressId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: 'Word not found' }, { status: 404 });
  }

  try {
    await requireStudentApiSession(existing.student_id);
  } catch (error) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  const timesSeen = Number(existing.times_seen ?? existing.total_attempts ?? 0) + 1;
  const timesCorrect =
    Number(existing.times_correct ?? existing.correct_attempts ?? 0) + (result === 'correct' ? 1 : 0);
  const timesWrong =
    Number(existing.times_wrong ?? 0) + (result === 'wrong' ? 1 : 0);
  const sessionsSeenCount =
    Number(existing.sessions_seen_count ?? existing.total_attempts ?? existing.times_seen ?? 0) + 1;
  const sessionsCorrectCount =
    Number(existing.sessions_correct_count ?? existing.correct_attempts ?? existing.times_correct ?? 0) +
    (result === 'correct' ? 1 : 0);
  const consecutiveCorrect =
    result === 'correct' ? Number(existing.consecutive_correct ?? 0) + 1 : 0;
  const consecutiveIncorrect =
    result === 'wrong' ? Number(existing.consecutive_incorrect ?? 0) + 1 : 0;

  const reviewDecision = evaluateReviewPolicy({
    isCorrect: result === 'correct',
    totalAttempts: sessionsSeenCount,
    correctAttempts: sessionsCorrectCount,
    wrongAttempts: timesWrong,
    consecutiveCorrect,
    consecutiveIncorrect,
    previousLifecycleState: existing.lifecycle_state ?? null,
    previousMasteryScore: Number(existing.mastery_score ?? 0),
    currentDifficultyBand: existing.current_difficulty_band ?? null,
    attemptDifficultyBand: existing.current_difficulty_band ?? null,
    lastModality: existing.last_modality ?? null,
    attemptModality: existing.last_modality ?? null,
    currentSessionIndex: null,
  });

  const { data, error } = await supabase
    .from('word_progress')
    .update({
      status: reviewDecision.status,
      lifecycle_state: reviewDecision.lifecycleState,
      current_difficulty_band: reviewDecision.nextDifficultyBand,
      mastery_score: reviewDecision.masteryScore,
      sessions_seen_count: sessionsSeenCount,
      sessions_correct_count: sessionsCorrectCount,
      total_attempts: sessionsSeenCount,
      correct_attempts: sessionsCorrectCount,
      times_seen: timesSeen,
      times_correct: timesCorrect,
      times_wrong: timesWrong,
      last_seen_at: new Date().toISOString(),
      next_review_date: reviewDecision.nextReviewDate,
      next_review_session_gap: reviewDecision.nextReviewSessionGap,
      next_review_session_index: reviewDecision.nextReviewSessionIndex,
      next_review_at: reviewDecision.nextReviewAt,
      minimum_time_gap_for_retention_check: reviewDecision.minimumTimeGapForRetentionCheck,
      consecutive_correct: consecutiveCorrect,
      consecutive_incorrect: consecutiveIncorrect,
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
