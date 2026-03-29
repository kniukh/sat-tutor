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
  currentSessionIndex: number | null;
  now?: Date;
};

export type ReviewPolicyDecision = {
  status: WordProgressStatus;
  lifecycleState: WordLifecycleState;
  masteryScore: number;
  nextReviewAt: string;
  nextReviewDate: string;
  nextReviewSessionGap: number;
  nextReviewSessionIndex: number | null;
  minimumTimeGapForRetentionCheck: string;
  srsStage: number;
  srsIntervalLabel: string;
  progressionReason: string;
  shouldQueue: boolean;
  priorityScore: number;
  queueReason: string;
  recommendedModality: ReviewQueueRow["recommended_modality"];
  nextDifficultyBand: VocabDifficultyBand | null;
};

const SESSION_SRS_GAPS = [1, 2, 4, 7] as const;
const SESSION_SRS_TIME_GAPS_HOURS = [12, 24, 72, 168] as const;

function addHours(baseDate: Date, hours: number) {
  const date = new Date(baseDate);
  date.setHours(date.getHours() + hours);
  return date;
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatIntervalFromHours(hours: number) {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  return `${hours} hour${hours === 1 ? "" : "s"}`;
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
    params.correctAttempts >= 4 &&
    params.consecutiveCorrect >= 3 &&
    params.masteryScore >= 0.82
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
    params.correctAttempts >= 2 &&
    (crossedModalities || params.totalAttempts >= 3 || params.consecutiveCorrect >= 2)
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

function getSrsStage(params: {
  correctAttempts: number;
  lifecycleState: WordLifecycleState;
  masteryScore: number;
}) {
  if (params.lifecycleState === "mastered" || params.masteryScore >= 0.82) {
    return 3;
  }

  return Math.max(0, Math.min(params.correctAttempts - 1, SESSION_SRS_GAPS.length - 1));
}

function getSpacingPlan(params: {
  lifecycleState: WordLifecycleState;
  isCorrect: boolean;
  correctAttempts: number;
  masteryScore: number;
}) {
  if (params.isCorrect) {
    const srsStage = getSrsStage({
      correctAttempts: params.correctAttempts,
      lifecycleState: params.lifecycleState,
      masteryScore: params.masteryScore,
    });

    return {
      srsStage,
      nextReviewHours: SESSION_SRS_TIME_GAPS_HOURS[srsStage],
      nextReviewSessionGap: SESSION_SRS_GAPS[srsStage],
      priorityScore:
        params.lifecycleState === "mastered"
          ? 0.24
          : params.lifecycleState === "review"
            ? 0.42
            : 0.62,
      queueReason:
        params.lifecycleState === "new"
          ? "first_exposure_followup"
          : params.lifecycleState === "mastered"
            ? "retention_validation"
            : "session_srs_progression",
      progressionReason:
        params.lifecycleState === "new"
          ? "new_word_intro"
          : params.lifecycleState === "mastered"
            ? "retention_check"
            : "session_gap_progression",
      srsIntervalLabel: `after_${SESSION_SRS_GAPS[srsStage]}_session${
        SESSION_SRS_GAPS[srsStage] === 1 ? "" : "s"
      }`,
    };
  }

  if (params.lifecycleState === "mastered") {
    return {
      srsStage: 0,
      nextReviewHours: 8,
      nextReviewSessionGap: 1,
      priorityScore: 0.99,
      queueReason: "mastery_relapse",
      progressionReason: "weak_again_retry",
      srsIntervalLabel: "retry_next_session",
    };
  }

  if (params.lifecycleState === "weak_again") {
    return {
      srsStage: 0,
      nextReviewHours: 8,
      nextReviewSessionGap: 1,
      priorityScore: 0.99,
      queueReason: "weak_again_recovery",
      progressionReason: "weak_again_retry",
      srsIntervalLabel: "retry_next_session",
    };
  }

  if (params.lifecycleState === "review") {
    return {
      srsStage: 0,
      nextReviewHours: 12,
      nextReviewSessionGap: 1,
      priorityScore: 0.9,
      queueReason: "review_slip",
      progressionReason: "review_recovery",
      srsIntervalLabel: "retry_next_session",
    };
  }

  if (params.lifecycleState === "new") {
    return {
      srsStage: 0,
      nextReviewHours: 8,
      nextReviewSessionGap: 1,
      priorityScore: 0.86,
      queueReason: "first_exposure_followup",
      progressionReason: "new_word_followup",
      srsIntervalLabel: "retry_next_session",
    };
  }

  return {
    srsStage: 0,
    nextReviewHours: 12,
    nextReviewSessionGap: 1,
    priorityScore: 0.95,
    queueReason: "incorrect_attempt",
    progressionReason: "learning_recovery",
    srsIntervalLabel: "retry_next_session",
  };
}

function getRecommendedModality(params: {
  isCorrect: boolean;
  attemptModality: VocabModality | null;
  lastModality: VocabModality | null;
  lifecycleState: WordLifecycleState;
}) {
  if (!params.isCorrect) {
    if (params.lifecycleState === "weak_again") {
      return "mixed" as const;
    }

    if (params.attemptModality === "audio") {
      return "text" as const;
    }

    if (params.attemptModality === "text") {
      return "context" as const;
    }

    if (params.attemptModality === "context") {
      return "text" as const;
    }

    return params.attemptModality ?? params.lastModality ?? "text";
  }

  if (params.lifecycleState === "mastered") {
    return params.attemptModality === "text" ? "context" : params.attemptModality ?? "context";
  }

  if (params.lifecycleState === "review") {
    return params.attemptModality ?? params.lastModality ?? "context";
  }

  return params.attemptModality ?? params.lastModality ?? "text";
}

function getNextDifficultyBand(params: {
  isCorrect: boolean;
  attemptDifficultyBand: VocabDifficultyBand | null;
  currentDifficultyBand: VocabDifficultyBand | null;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  lifecycleState: WordLifecycleState;
}) {
  const band = params.attemptDifficultyBand ?? params.currentDifficultyBand;

  if (!band) {
    return params.attemptDifficultyBand ?? params.currentDifficultyBand ?? null;
  }

  if (!params.isCorrect && (params.consecutiveIncorrect >= 2 || params.lifecycleState === "weak_again")) {
    if (band === "hard") return "medium";
    if (band === "medium") return "easy";
  }

  if (
    params.isCorrect &&
    params.lifecycleState !== "new" &&
    params.consecutiveCorrect >= 3
  ) {
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
    correctAttempts: input.correctAttempts,
    masteryScore,
  });
  const nextReviewAt = addHours(now, spacingPlan.nextReviewHours);
  const nextReviewSessionIndex =
    input.currentSessionIndex !== null
      ? input.currentSessionIndex + spacingPlan.nextReviewSessionGap
      : null;

  return {
    status,
    lifecycleState,
    masteryScore,
    nextReviewAt: nextReviewAt.toISOString(),
    nextReviewDate: formatDateOnly(nextReviewAt),
    nextReviewSessionGap: spacingPlan.nextReviewSessionGap,
    nextReviewSessionIndex,
    minimumTimeGapForRetentionCheck: formatIntervalFromHours(spacingPlan.nextReviewHours),
    srsStage: spacingPlan.srsStage,
    srsIntervalLabel: spacingPlan.srsIntervalLabel,
    progressionReason: spacingPlan.progressionReason,
    shouldQueue: true,
    priorityScore: spacingPlan.priorityScore,
    queueReason: spacingPlan.queueReason,
    recommendedModality: getRecommendedModality({
      isCorrect: input.isCorrect,
      attemptModality: input.attemptModality,
      lastModality: input.lastModality,
      lifecycleState,
    }),
    nextDifficultyBand: getNextDifficultyBand({
      isCorrect: input.isCorrect,
      attemptDifficultyBand: input.attemptDifficultyBand,
      currentDifficultyBand: input.currentDifficultyBand,
      consecutiveCorrect: input.consecutiveCorrect,
      consecutiveIncorrect: input.consecutiveIncorrect,
      lifecycleState,
    }),
  };
}
