import type { VocabularySessionPhase } from "@/types/vocab-exercises";

export type XpEventType =
  | "generic_activity"
  | "reading_question_attempt"
  | "reading_lesson_complete"
  | "vocab_exercise_attempt"
  | "vocab_session_complete"
  | "writing_submission"
  | "legacy_vocab_review";

export type VocabularyExerciseXpBreakdown = {
  baseXp: number;
  actionLabel: "correct" | "correct_after_mistake" | "incorrect";
  comboCountAfter: number;
  comboMultiplier: number;
  rawXp: number;
  sameSessionMultiplier: number;
  alreadyAwardedForWordThisSession: number;
  perWordSessionCap: number;
  capRemaining: number;
  totalXp: number;
};

export type VocabularySessionXpBreakdown = {
  baseXp: number;
  accuracyBonusXp: number;
  dueReviewBonusXp: number;
  antiAbuseAdjustmentXp: number;
  totalXp: number;
  recentMicroSessionCount: number;
  appliedMicroSessionMultiplier: number;
};

export type ReadingQuestionXpBreakdown = {
  baseXp: number;
  comboCountAfter: number;
  comboMultiplier: number;
  totalXp: number;
};

export type ReadingLessonXpBreakdown = {
  completionXp: number;
  accuracyBonusXp: number;
  totalXp: number;
};

function getComboMultiplier(comboCountAfter: number) {
  if (comboCountAfter >= 8) {
    return 2;
  }

  if (comboCountAfter >= 5) {
    return 1.5;
  }

  if (comboCountAfter >= 3) {
    return 1.2;
  }

  return 1;
}

function getMicroSessionMultiplier(params: {
  completedCount: number;
  recentMicroSessionCount: number;
}) {
  if (params.completedCount >= 5) {
    return 1;
  }

  if (params.recentMicroSessionCount >= 3) {
    return 0.35;
  }

  if (params.recentMicroSessionCount === 2) {
    return 0.5;
  }

  if (params.completedCount <= 2) {
    return 0.6;
  }

  return 0.8;
}

export function calculateVocabularyExerciseXp(params: {
  isCorrect: boolean;
  attemptCount: number;
  comboCountAfter: number;
  alreadyAwardedForWordThisSession: number;
  sameSessionCreditCapped?: boolean;
  perWordSessionCap?: number;
}) {
  const actionLabel = !params.isCorrect
    ? "incorrect"
    : params.attemptCount > 1
      ? "correct_after_mistake"
      : "correct";
  const baseXp =
    actionLabel === "correct"
      ? 5
      : actionLabel === "correct_after_mistake"
        ? 2
        : 0;
  const comboMultiplier = params.isCorrect ? getComboMultiplier(params.comboCountAfter) : 1;
  const sameSessionMultiplier = params.sameSessionCreditCapped ? 0.7 : 1;
  const rawXp =
    baseXp <= 0 ? 0 : Math.max(1, Math.round(baseXp * comboMultiplier * sameSessionMultiplier));
  const perWordSessionCap = params.perWordSessionCap ?? 12;
  const capRemaining = Math.max(0, perWordSessionCap - params.alreadyAwardedForWordThisSession);
  const totalXp = Math.min(rawXp, capRemaining);

  return {
    baseXp,
    actionLabel,
    comboCountAfter: params.comboCountAfter,
    comboMultiplier,
    rawXp,
    sameSessionMultiplier,
    alreadyAwardedForWordThisSession: params.alreadyAwardedForWordThisSession,
    perWordSessionCap,
    capRemaining,
    totalXp,
  } satisfies VocabularyExerciseXpBreakdown;
}

export function calculateVocabularySessionReward(params: {
  completedCount: number;
  accuracy: number;
  sessionMode: string | null | undefined;
  sessionPhase?: VocabularySessionPhase | null;
  recentMicroSessionCount?: number;
}) {
  const baseXp =
    params.completedCount >= 8
      ? 6
      : params.completedCount >= 5
        ? 4
        : params.completedCount >= 3
          ? 2
          : params.completedCount > 0
            ? 1
            : 0;
  const accuracyBonusXp =
    params.accuracy >= 95
      ? 5
      : params.accuracy >= 85
        ? 3
        : params.accuracy >= 75
          ? 2
          : 0;
  const dueReviewBonusXp =
    params.sessionMode === "review_weak_words" || params.sessionPhase === "priority_review"
      ? 2
      : 0;
  const rawTotal = baseXp + accuracyBonusXp + dueReviewBonusXp;
  const recentMicroSessionCount = Math.max(0, params.recentMicroSessionCount ?? 0);
  const appliedMicroSessionMultiplier = getMicroSessionMultiplier({
    completedCount: params.completedCount,
    recentMicroSessionCount,
  });
  const adjustedTotal =
    rawTotal <= 0 ? 0 : Math.max(1, Math.round(rawTotal * appliedMicroSessionMultiplier));
  const antiAbuseAdjustmentXp = adjustedTotal - rawTotal;

  return {
    baseXp,
    accuracyBonusXp,
    dueReviewBonusXp,
    antiAbuseAdjustmentXp,
    totalXp: adjustedTotal,
    recentMicroSessionCount,
    appliedMicroSessionMultiplier,
  } satisfies VocabularySessionXpBreakdown;
}

export function calculateReadingQuestionXp(params: {
  isCorrect: boolean;
  comboCountAfter: number;
}) {
  const baseXp = params.isCorrect ? 10 : 0;
  const comboMultiplier = params.isCorrect ? getComboMultiplier(params.comboCountAfter) : 1;
  const totalXp = baseXp <= 0 ? 0 : Math.max(1, Math.round(baseXp * comboMultiplier));

  return {
    baseXp,
    comboCountAfter: params.comboCountAfter,
    comboMultiplier,
    totalXp,
  } satisfies ReadingQuestionXpBreakdown;
}

export function calculateReadingMistakeFixXp(params: {
  comboCountAfter: number;
}) {
  const baseXp = 8;
  const comboMultiplier = getComboMultiplier(params.comboCountAfter);

  return {
    baseXp,
    comboCountAfter: params.comboCountAfter,
    comboMultiplier,
    totalXp: Math.max(1, Math.round(baseXp * comboMultiplier)),
  } satisfies ReadingQuestionXpBreakdown;
}

export function calculateReadingLessonCompletionXp(params: {
  totalQuestions: number;
  accuracy: number;
}) {
  const completionXp =
    params.totalQuestions >= 10 ? 6 : params.totalQuestions >= 6 ? 4 : params.totalQuestions > 0 ? 2 : 0;
  const accuracyBonusXp =
    params.accuracy >= 0.95 ? 4 : params.accuracy >= 0.85 ? 3 : params.accuracy >= 0.7 ? 2 : 0;

  return {
    completionXp,
    accuracyBonusXp,
    totalXp: completionXp + accuracyBonusXp,
  } satisfies ReadingLessonXpBreakdown;
}
