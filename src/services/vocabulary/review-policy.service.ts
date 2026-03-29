import type {
  ReviewQueueRow,
  VocabDifficultyBand,
  VocabModality,
  WordLifecycleState,
  WordProgressStatus,
} from "@/types/vocab-tracking";

export type ReviewPolicyInput = {
  isCorrect: boolean;
  totalAttempts: number;
  correctAttempts: number;
  wrongAttempts: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  previousLifecycleState: WordLifecycleState | null;
  previousMasteryScore: number | null;
  currentDifficultyBand: VocabDifficultyBand | null;
  attemptDifficultyBand: VocabDifficultyBand | null;
  lastModality: VocabModality | null;
  attemptModality: VocabModality | null;
  now?: Date;
};

export type ReviewPolicyDecision = {
  status: WordProgressStatus;
  lifecycleState: WordLifecycleState;
  masteryScore: number;
  nextReviewAt: string;
  nextReviewDate: string;
  shouldQueue: boolean;
  priorityScore: number;
  queueReason: string;
  recommendedModality: ReviewQueueRow["recommended_modality"];
  nextDifficultyBand: VocabDifficultyBand | null;
};

function addDays(baseDate: Date, days: number) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date;
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function computeMasteryScore(params: {
  previousMasteryScore: number | null;
  isCorrect: boolean;
  totalAttempts: number;
  correctAttempts: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  attemptModality: VocabModality | null;
  lastModality: VocabModality | null;
}) {
  if (params.totalAttempts <= 0) {
    return 0;
  }

  const previous = params.previousMasteryScore ?? 0;
  const accuracy = params.correctAttempts / params.totalAttempts;
  const modalityBonus =
    params.isCorrect &&
    params.attemptModality &&
    params.lastModality &&
    params.attemptModality !== params.lastModality
      ? 0.05
      : 0;
  const directionDelta = params.isCorrect
    ? 0.16 + params.consecutiveCorrect * 0.04 + modalityBonus
    : -0.22 - params.consecutiveIncorrect * 0.04;
  const blended = previous * 0.45 + accuracy * 0.55 + directionDelta;

  return Math.max(0, Math.min(1, Number(blended.toFixed(4))));
}

function getLifecycleState(params: {
  isCorrect: boolean;
  totalAttempts: number;
  correctAttempts: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  previousLifecycleState: WordLifecycleState | null;
  masteryScore: number;
  lastModality: VocabModality | null;
  attemptModality: VocabModality | null;
}) {
  if (params.totalAttempts === 1) {
    return "new" as const;
  }

  if (!params.isCorrect && params.previousLifecycleState === "mastered") {
    return "weak_again" as const;
  }

  if (
    params.isCorrect &&
    params.correctAttempts >= 5 &&
    params.consecutiveCorrect >= 3 &&
    params.masteryScore >= 0.85
  ) {
    return "mastered" as const;
  }

  const crossedModalities =
    params.isCorrect &&
    params.lastModality &&
    params.attemptModality &&
    params.lastModality !== params.attemptModality;

  if (
    params.isCorrect &&
    params.correctAttempts >= 3 &&
    (crossedModalities || params.totalAttempts >= 4 || params.consecutiveCorrect >= 2)
  ) {
    return "review" as const;
  }

  if (!params.isCorrect && params.consecutiveIncorrect >= 2) {
    return "learning" as const;
  }

  return "learning" as const;
}

function getStatusForLifecycle(lifecycleState: WordLifecycleState): WordProgressStatus {
  if (lifecycleState === "mastered") {
    return "mastered";
  }

  if (lifecycleState === "review") {
    return "review";
  }

  return "learning";
}

function getSpacingPlan(params: {
  lifecycleState: WordLifecycleState;
  isCorrect: boolean;
}) {
  if (params.lifecycleState === "mastered") {
    return {
      nextReviewDays: 14,
      priorityScore: 0.2,
      queueReason: "mastery_maintenance",
    };
  }

  if (params.lifecycleState === "review") {
    return {
      nextReviewDays: params.isCorrect ? 4 : 1,
      priorityScore: params.isCorrect ? 0.4 : 0.88,
      queueReason: params.isCorrect ? "review_progression" : "review_slip",
    };
  }

  if (params.lifecycleState === "weak_again") {
    return {
      nextReviewDays: 1,
      priorityScore: 0.99,
      queueReason: "mastery_relapse",
    };
  }

  if (params.lifecycleState === "new") {
    return {
      nextReviewDays: 1,
      priorityScore: 0.8,
      queueReason: "first_exposure_followup",
    };
  }

  return {
    nextReviewDays: params.isCorrect ? 2 : 1,
    priorityScore: params.isCorrect ? 0.62 : 0.95,
    queueReason: params.isCorrect ? "learning_progression" : "incorrect_attempt",
  };
}

function getRecommendedModality(params: {
  isCorrect: boolean;
  attemptModality: VocabModality | null;
  lastModality: VocabModality | null;
}) {
  if (!params.isCorrect) {
    if (params.attemptModality === "text") {
      return "context" as const;
    }

    return params.attemptModality ?? params.lastModality ?? "text";
  }

  return params.attemptModality ?? params.lastModality ?? "text";
}

function getNextDifficultyBand(params: {
  isCorrect: boolean;
  attemptDifficultyBand: VocabDifficultyBand | null;
  currentDifficultyBand: VocabDifficultyBand | null;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
}) {
  const band = params.attemptDifficultyBand ?? params.currentDifficultyBand;

  if (!band) {
    return params.attemptDifficultyBand ?? params.currentDifficultyBand ?? null;
  }

  if (!params.isCorrect && params.consecutiveIncorrect >= 2) {
    if (band === "hard") return "medium";
    if (band === "medium") return "easy";
  }

  if (params.isCorrect && params.consecutiveCorrect >= 3) {
    if (band === "easy") return "medium";
    if (band === "medium") return "hard";
  }

  return band;
}

export function evaluateReviewPolicy(input: ReviewPolicyInput): ReviewPolicyDecision {
  const now = input.now ?? new Date();
  const masteryScore = computeMasteryScore({
    previousMasteryScore: input.previousMasteryScore,
    isCorrect: input.isCorrect,
    totalAttempts: input.totalAttempts,
    correctAttempts: input.correctAttempts,
    consecutiveCorrect: input.consecutiveCorrect,
    consecutiveIncorrect: input.consecutiveIncorrect,
    attemptModality: input.attemptModality,
    lastModality: input.lastModality,
  });
  const lifecycleState = getLifecycleState({
    isCorrect: input.isCorrect,
    totalAttempts: input.totalAttempts,
    correctAttempts: input.correctAttempts,
    consecutiveCorrect: input.consecutiveCorrect,
    consecutiveIncorrect: input.consecutiveIncorrect,
    previousLifecycleState: input.previousLifecycleState,
    masteryScore,
    lastModality: input.lastModality,
    attemptModality: input.attemptModality,
  });
  const status = getStatusForLifecycle(lifecycleState);
  const spacingPlan = getSpacingPlan({
    lifecycleState,
    isCorrect: input.isCorrect,
  });
  const nextReviewAt = addDays(now, spacingPlan.nextReviewDays);

  return {
    status,
    lifecycleState,
    masteryScore,
    nextReviewAt: nextReviewAt.toISOString(),
    nextReviewDate: formatDateOnly(nextReviewAt),
    shouldQueue: true,
    priorityScore: spacingPlan.priorityScore,
    queueReason: spacingPlan.queueReason,
    recommendedModality: getRecommendedModality({
      isCorrect: input.isCorrect,
      attemptModality: input.attemptModality,
      lastModality: input.lastModality,
    }),
    nextDifficultyBand: getNextDifficultyBand({
      isCorrect: input.isCorrect,
      attemptDifficultyBand: input.attemptDifficultyBand,
      currentDifficultyBand: input.currentDifficultyBand,
      consecutiveCorrect: input.consecutiveCorrect,
      consecutiveIncorrect: input.consecutiveIncorrect,
    }),
  };
}
