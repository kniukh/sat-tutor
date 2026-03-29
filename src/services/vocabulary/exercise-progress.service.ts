import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ExerciseAttemptRow, ReviewQueueRow, WordProgressRow } from "@/types/vocab-tracking";
import { evaluateReviewPolicy } from "@/services/vocabulary/review-policy.service";
import { syncReviewQueueForWordProgress } from "@/services/vocabulary/review-queue.service";

export async function applyExerciseAttemptToProgress(params: {
  studentId: string;
  attempt: ExerciseAttemptRow;
}) {
  const supabase = await createServerSupabaseClient();

  const targetWordId = params.attempt.target_word_id;
  const targetWord = params.attempt.target_word?.trim().toLowerCase() ?? null;

  let existing: Partial<WordProgressRow> & { id: string; student_id: string } | null = null;

  if (targetWordId) {
    const { data, error } = await supabase
      .from("word_progress")
      .select("*")
      .eq("student_id", params.studentId)
      .eq("word_id", targetWordId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    existing = data;
  }

  if (!existing && targetWord) {
    const { data, error } = await supabase
      .from("word_progress")
      .select("*")
      .eq("student_id", params.studentId)
      .eq("word", targetWord)
      .maybeSingle();

    if (error) {
      throw error;
    }

    existing = data;
  }

  const previousTotalAttempts = Number(existing?.total_attempts ?? existing?.times_seen ?? 0);
  const previousCorrectAttempts = Number(existing?.correct_attempts ?? existing?.times_correct ?? 0);
  const previousWrongAttempts = Number(existing?.times_wrong ?? 0);
  const totalAttempts = previousTotalAttempts + 1;
  const correctAttempts = previousCorrectAttempts + (params.attempt.is_correct ? 1 : 0);
  const wrongAttempts = previousWrongAttempts + (params.attempt.is_correct ? 0 : 1);
  const consecutiveCorrect = params.attempt.is_correct
    ? Number(existing?.consecutive_correct ?? 0) + 1
    : 0;
  const consecutiveIncorrect = params.attempt.is_correct
    ? 0
    : Number(existing?.consecutive_incorrect ?? 0) + 1;

  const reviewDecision = evaluateReviewPolicy({
    isCorrect: params.attempt.is_correct,
    totalAttempts,
    correctAttempts,
    wrongAttempts,
    consecutiveCorrect,
    consecutiveIncorrect,
    previousLifecycleState: existing?.lifecycle_state ?? null,
    previousMasteryScore: Number(existing?.mastery_score ?? 0),
    currentDifficultyBand: existing?.current_difficulty_band ?? null,
    attemptDifficultyBand: params.attempt.difficulty_band,
    lastModality: existing?.last_modality ?? null,
    attemptModality: params.attempt.modality,
  });

  const progressPayload = {
    student_id: params.studentId,
    word: targetWord ?? existing?.word ?? "",
    word_id: targetWordId ?? existing?.word_id ?? null,
    status: reviewDecision.status,
    lifecycle_state: reviewDecision.lifecycleState,
    current_difficulty_band: reviewDecision.nextDifficultyBand,
    mastery_score: reviewDecision.masteryScore,
    total_attempts: totalAttempts,
    correct_attempts: correctAttempts,
    times_seen: totalAttempts,
    times_correct: correctAttempts,
    times_wrong: wrongAttempts,
    last_seen_at: params.attempt.created_at,
    next_review_date: reviewDecision.nextReviewDate,
    next_review_at: reviewDecision.nextReviewAt,
    consecutive_correct: consecutiveCorrect,
    consecutive_incorrect: consecutiveIncorrect,
    last_modality: params.attempt.modality ?? existing?.last_modality ?? null,
    source_lesson_id: params.attempt.lesson_id,
    metadata: {
      ...(existing?.metadata ?? {}),
      latest_attempt_id: params.attempt.id,
      latest_session_id: params.attempt.session_id,
    },
    updated_at: new Date().toISOString(),
  };

  let progressRow:
    | {
        id: string;
        word_id: string | null;
        lifecycle_state: WordProgressRow["lifecycle_state"];
        mastery_score: number;
        next_review_at: string | null;
      }
    | null = null;

  if (!existing) {
    const { data, error } = await supabase
      .from("word_progress")
      .insert({
        ...progressPayload,
        created_at: new Date().toISOString(),
      })
      .select("id, word_id, lifecycle_state, mastery_score, next_review_at")
      .single();

    if (error) {
      throw error;
    }

    progressRow = data;
  } else {
    const { data, error } = await supabase
      .from("word_progress")
      .update(progressPayload)
      .eq("id", existing.id)
      .select("id, word_id, lifecycle_state, mastery_score, next_review_at")
      .single();

    if (error) {
      throw error;
    }

    progressRow = data;
  }

  if (!progressRow?.word_id) {
    return { progressRow, reviewQueueRow: null };
  }

  const reviewQueueRow = (await syncReviewQueueForWordProgress({
    studentId: params.studentId,
    wordProgressId: progressRow.id,
    sourceAttemptId: params.attempt.id,
  })) as ReviewQueueRow | null;

  return { progressRow, reviewQueueRow };
}
