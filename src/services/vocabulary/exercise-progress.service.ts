import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ExerciseAttemptRow, ReviewQueueRow, WordProgressRow } from "@/types/vocab-tracking";
import { evaluateReviewPolicy } from "@/services/vocabulary/review-policy.service";
import { syncReviewQueueForWordProgress } from "@/services/vocabulary/review-queue.service";
import { ensureVocabularySessionForAttempt } from "@/services/vocabulary/vocab-session.service";

export async function applyExerciseAttemptToProgress(params: {
  studentId: string;
  attempt: ExerciseAttemptRow;
}) {
  const supabase = await createServerSupabaseClient();
  const sessionMode =
    typeof params.attempt.metadata?.session_mode === "string"
      ? params.attempt.metadata.session_mode
      : null;
  const clientAttemptMetadata =
    params.attempt.metadata?.client_attempt_metadata &&
    typeof params.attempt.metadata.client_attempt_metadata === "object"
      ? (params.attempt.metadata.client_attempt_metadata as Record<string, unknown>)
      : null;
  const session = await ensureVocabularySessionForAttempt({
    studentId: params.studentId,
    sessionId: params.attempt.session_id,
    sessionMode: sessionMode as any,
    sessionMetadata: clientAttemptMetadata,
    attemptCreatedAt: params.attempt.created_at,
    isCorrect: params.attempt.is_correct,
  });

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

  const previousSessionAttempts = Number(
    existing?.sessions_seen_count ?? existing?.total_attempts ?? existing?.times_seen ?? 0
  );
  const previousSessionCorrectAttempts = Number(
    existing?.sessions_correct_count ?? existing?.correct_attempts ?? existing?.times_correct ?? 0
  );
  const previousTotalAttempts = Number(existing?.times_seen ?? existing?.total_attempts ?? 0);
  const previousCorrectAttempts = Number(existing?.times_correct ?? existing?.correct_attempts ?? 0);
  const previousWrongAttempts = Number(existing?.times_wrong ?? 0);
  const totalAttempts = previousTotalAttempts + 1;
  const correctAttempts = previousCorrectAttempts + (params.attempt.is_correct ? 1 : 0);
  const wrongAttempts = previousWrongAttempts + (params.attempt.is_correct ? 0 : 1);
  const sameSessionCreditCapped =
    existing?.last_progress_credited_session_id === params.attempt.session_id;
  const creditedSessionAttempts =
    previousSessionAttempts + (sameSessionCreditCapped ? 0 : 1);
  const creditedSessionCorrectAttempts =
    previousSessionCorrectAttempts +
    (!sameSessionCreditCapped && params.attempt.is_correct ? 1 : 0);
  const consecutiveCorrect =
    !sameSessionCreditCapped && params.attempt.is_correct
      ? Number(existing?.consecutive_correct ?? 0) + 1
      : sameSessionCreditCapped
        ? Number(existing?.consecutive_correct ?? 0)
        : 0;
  const consecutiveIncorrect =
    !sameSessionCreditCapped && !params.attempt.is_correct
      ? Number(existing?.consecutive_incorrect ?? 0) + 1
      : sameSessionCreditCapped
        ? Number(existing?.consecutive_incorrect ?? 0)
        : 0;

  const reviewDecision = evaluateReviewPolicy({
    isCorrect: params.attempt.is_correct,
    totalAttempts: creditedSessionAttempts,
    correctAttempts: creditedSessionCorrectAttempts,
    wrongAttempts,
    consecutiveCorrect,
    consecutiveIncorrect,
    previousLifecycleState: existing?.lifecycle_state ?? null,
    previousMasteryScore: Number(existing?.mastery_score ?? 0),
    currentDifficultyBand: existing?.current_difficulty_band ?? null,
    attemptDifficultyBand: params.attempt.difficulty_band,
    lastModality: existing?.last_modality ?? null,
    attemptModality: params.attempt.modality,
    currentSessionIndex: session.sequence_index,
  });

  const latestDecisionMetadata = {
    latest_attempt_id: params.attempt.id,
    latest_session_id: params.attempt.session_id,
    current_session_index: session.sequence_index,
    srs_stage: reviewDecision.srsStage,
    srs_interval_label: reviewDecision.srsIntervalLabel,
    progression_reason: reviewDecision.progressionReason,
    scheduled_after_sessions: reviewDecision.nextReviewSessionGap,
    scheduled_after_time_gap: reviewDecision.minimumTimeGapForRetentionCheck,
    due_by_session_gap: Boolean(
      reviewDecision.nextReviewSessionIndex !== null &&
        session.sequence_index >= reviewDecision.nextReviewSessionIndex
    ),
    due_by_time_gap:
      new Date(reviewDecision.nextReviewAt).getTime() <= new Date(params.attempt.created_at).getTime(),
    weak_again_retry:
      (sameSessionCreditCapped
        ? existing?.lifecycle_state
        : reviewDecision.lifecycleState) === "weak_again",
    overdue_review: false,
    same_session_credit_capped: sameSessionCreditCapped,
    last_queue_reason: reviewDecision.queueReason,
  };
  const effectiveLifecycleState = sameSessionCreditCapped
    ? existing?.lifecycle_state ?? reviewDecision.lifecycleState
    : reviewDecision.lifecycleState;
  const effectiveStatus = sameSessionCreditCapped
    ? existing?.status ?? reviewDecision.status
    : reviewDecision.status;
  const effectiveMasteryScore = sameSessionCreditCapped
    ? Number(existing?.mastery_score ?? reviewDecision.masteryScore)
    : reviewDecision.masteryScore;
  const effectiveDifficultyBand = sameSessionCreditCapped
    ? existing?.current_difficulty_band ?? reviewDecision.nextDifficultyBand
    : reviewDecision.nextDifficultyBand;

  const progressPayload = {
    student_id: params.studentId,
    word: targetWord ?? existing?.word ?? "",
    word_id: targetWordId ?? existing?.word_id ?? null,
    status: effectiveStatus,
    lifecycle_state: effectiveLifecycleState,
    current_difficulty_band: effectiveDifficultyBand,
    mastery_score: effectiveMasteryScore,
    sessions_seen_count: creditedSessionAttempts,
    sessions_correct_count: creditedSessionCorrectAttempts,
    total_attempts: creditedSessionAttempts,
    correct_attempts: creditedSessionCorrectAttempts,
    times_seen: totalAttempts,
    times_correct: correctAttempts,
    times_wrong: wrongAttempts,
    last_seen_at: params.attempt.created_at,
    last_seen_session_id: params.attempt.session_id,
    last_correct_session_id: params.attempt.is_correct
      ? params.attempt.session_id
      : existing?.last_correct_session_id ?? null,
    next_review_date: sameSessionCreditCapped
      ? existing?.next_review_date ?? reviewDecision.nextReviewDate
      : reviewDecision.nextReviewDate,
    next_review_session_gap: sameSessionCreditCapped
      ? existing?.next_review_session_gap ?? reviewDecision.nextReviewSessionGap
      : reviewDecision.nextReviewSessionGap,
    next_review_session_index: sameSessionCreditCapped
      ? existing?.next_review_session_index ?? null
      : reviewDecision.nextReviewSessionIndex,
    next_review_at: sameSessionCreditCapped
      ? existing?.next_review_at ?? reviewDecision.nextReviewAt
      : reviewDecision.nextReviewAt,
    minimum_time_gap_for_retention_check: sameSessionCreditCapped
      ? existing?.minimum_time_gap_for_retention_check ?? null
      : reviewDecision.minimumTimeGapForRetentionCheck,
    consecutive_correct: consecutiveCorrect,
    consecutive_incorrect: consecutiveIncorrect,
    last_progress_credited_session_id: sameSessionCreditCapped
      ? existing?.last_progress_credited_session_id ?? null
      : params.attempt.session_id,
    last_modality: params.attempt.modality ?? existing?.last_modality ?? null,
    source_lesson_id: params.attempt.lesson_id,
    metadata: {
      ...(existing?.metadata ?? {}),
      repetition_engine: "session_based_v1",
      ...latestDecisionMetadata,
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
        sessions_seen_count: number;
        sessions_correct_count: number;
      }
    | null = null;

  if (!existing) {
    const { data, error } = await supabase
      .from("word_progress")
      .insert({
        ...progressPayload,
        created_at: new Date().toISOString(),
      })
      .select("id, word_id, lifecycle_state, mastery_score, next_review_at, sessions_seen_count, sessions_correct_count")
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
      .select("id, word_id, lifecycle_state, mastery_score, next_review_at, sessions_seen_count, sessions_correct_count")
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
    currentSessionIndex: session.sequence_index,
  })) as ReviewQueueRow | null;

  return { progressRow, reviewQueueRow, sameSessionCreditCapped, session };
}
