import type { VocabularySessionPhase } from "@/types/vocab-exercises";
import type { VocabExerciseType, WordLifecycleState } from "@/types/vocab-tracking";

export type XpEventType =
  | "generic_activity"
  | "reading_question_attempt"
  | "reading_lesson_complete"
  | "vocab_exercise_attempt"
  | "vocab_session_complete"
  | "writing_submission"
  | "legacy_vocab_review";

export type VocabularyExerciseXpBreakdown = {
  completionXp: number;
  correctnessXp: number;
  rawXp: number;
  lifecycleMultiplier: number;
  repetitionMultiplier: number;
  sameSessionMultiplier: number;
  exposureIndex: number;
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
  completionXp: number;
  correctnessXp: number;
  questionDifficultyWeight: number;
  totalXp: number;
};

export type ReadingLessonXpBreakdown = {
  completionXp: number;
  accuracyBonusXp: number;
  totalXp: number;
};

const VOCAB_EXERCISE_BASE_XP: Record<VocabExerciseType, number> = {
  meaning_match: 1,
  translation_match: 1,
  synonym: 1,
  collocation: 1,
  listen_match: 1,
  spelling_from_audio: 2,
  fill_blank: 2,
  context_meaning: 2,
  pair_match: 2,
  sentence_builder: 3,
  error_detection: 3,
  spelling: 1,
  memory: 1,
  speed_round: 1,
};

const WORD_LIFECYCLE_MULTIPLIER: Record<WordLifecycleState | "review" | "unknown", number> = {
  weak_again: 1.8,
  learning: 1.45,
  new: 1.3,
  review: 1.1,
  mastered: 0.7,
  unknown: 1,
};

function getVocabularyExerciseBaseXp(exerciseType: VocabExerciseType) {
  return VOCAB_EXERCISE_BASE_XP[exerciseType] ?? 1;
}

function getWordLifecycleMultiplier(lifecycleState: WordLifecycleState | null | undefined) {
  if (!lifecycleState) {
    return WORD_LIFECYCLE_MULTIPLIER.unknown;
  }

  return WORD_LIFECYCLE_MULTIPLIER[lifecycleState] ?? WORD_LIFECYCLE_MULTIPLIER.unknown;
}

function getRepetitionMultiplier(exposureIndex: number) {
  if (exposureIndex <= 1) {
    return 1;
  }

  if (exposureIndex === 2) {
    return 0.75;
  }

  if (exposureIndex === 3) {
    return 0.5;
  }

  return 0.3;
}

function getReadingQuestionDifficultyWeight(questionType: string | null | undefined) {
  const normalized = questionType?.trim().toLowerCase() ?? "";

  if (
    normalized.includes("inference") ||
    normalized.includes("evidence") ||
    normalized.includes("synthesis") ||
    normalized.includes("rhetoric") ||
    normalized.includes("purpose") ||
    normalized.includes("function")
  ) {
    return 3;
  }

  if (
    normalized.includes("vocabulary") ||
    normalized.includes("detail") ||
    normalized.includes("command")
  ) {
    return 1;
  }

  return 2;
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
  exerciseType: VocabExerciseType;
  isCorrect: boolean;
  lifecycleState?: WordLifecycleState | null;
  exposureIndex: number;
  alreadyAwardedForWordThisSession: number;
  sameSessionCreditCapped?: boolean;
  perWordSessionCap?: number;
}) {
  const completionXp = getVocabularyExerciseBaseXp(params.exerciseType);
  const correctnessXp = params.isCorrect ? completionXp : 0;
  const lifecycleMultiplier = getWordLifecycleMultiplier(params.lifecycleState);
  const repetitionMultiplier = getRepetitionMultiplier(params.exposureIndex);
  const sameSessionMultiplier = params.sameSessionCreditCapped ? 0.7 : 1;
  const rawXp = Math.max(
    1,
    Math.round(
      (completionXp + correctnessXp) *
        lifecycleMultiplier *
        repetitionMultiplier *
        sameSessionMultiplier
    )
  );
  const perWordSessionCap = params.perWordSessionCap ?? 12;
  const capRemaining = Math.max(0, perWordSessionCap - params.alreadyAwardedForWordThisSession);
  const totalXp = Math.min(rawXp, capRemaining);

  return {
    completionXp,
    correctnessXp,
    rawXp,
    lifecycleMultiplier,
    repetitionMultiplier,
    sameSessionMultiplier,
    exposureIndex: params.exposureIndex,
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
  questionType?: string | null;
  isCorrect: boolean;
}) {
  const questionDifficultyWeight = getReadingQuestionDifficultyWeight(params.questionType);
  const completionXp = questionDifficultyWeight;
  const correctnessXp = params.isCorrect ? questionDifficultyWeight : 0;

  return {
    completionXp,
    correctnessXp,
    questionDifficultyWeight,
    totalXp: completionXp + correctnessXp,
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
