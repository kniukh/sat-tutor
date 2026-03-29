import type {
  ExerciseAttemptRow,
  VocabDifficultyBand,
  VocabModality,
  WordLifecycleState,
} from "@/types/vocab-tracking";

export type AdaptiveDifficultySelectionBucket =
  | "weak_recent"
  | "reinforcement"
  | "newer_words"
  | "retention_check";

export type SessionDifficultyBias = "supportive" | "balanced" | "stretch";

export type AdaptiveDifficultyCandidate = {
  wordId: string;
  lifecycleState: WordLifecycleState | null;
  masteryScore: number | null;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  currentDifficultyBand: VocabDifficultyBand | null;
  lastModality: VocabModality | null;
  recommendedModality: VocabModality | null;
  recentAttempts: ExerciseAttemptRow[];
  isNewWord: boolean;
  lessonFirstExposure: boolean;
  sourceLessonId: string | null;
};

export type AdaptiveDifficultyProfile = {
  bias: SessionDifficultyBias;
  reason: string;
  recentAttemptCount: number;
  overallAccuracy: number | null;
  averageResponseTimeMs: number | null;
  strugglingWordCount: number;
  fastAccurateWordCount: number;
};

export type AdaptiveDifficultyDecision = {
  difficultyBand: VocabDifficultyBand;
  reason: string;
  decisionRule:
    | "lesson_support_path"
    | "repeated_miss_support"
    | "broad_support_bias"
    | "retention_stretch"
    | "fast_accurate_stretch"
    | "steady_progression";
  recentAccuracy: number | null;
  averageResponseTimeMs: number | null;
  strongestModality: VocabModality | null;
  weakestModality: VocabModality | null;
};

type AttemptSummary = {
  attemptCount: number;
  recentAccuracy: number | null;
  averageResponseTimeMs: number | null;
  correctCount: number;
  incorrectCount: number;
  strongestModality: VocabModality | null;
  weakestModality: VocabModality | null;
};

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function summarizeAttempts(attempts: ExerciseAttemptRow[]): AttemptSummary {
  const attemptCount = attempts.length;
  const correctCount = attempts.filter((attempt) => attempt.is_correct).length;
  const incorrectCount = attemptCount - correctCount;
  const recentAccuracy = attemptCount > 0 ? correctCount / attemptCount : null;
  const averageResponseTimeMs = average(
    attempts
      .map((attempt) => Number(attempt.response_time_ms))
      .filter((value) => Number.isFinite(value) && value > 0)
  );
  const modalityStats = attempts.reduce<
    Map<VocabModality, { attempts: number; correct: number }>
  >((accumulator, attempt) => {
    if (!attempt.modality) {
      return accumulator;
    }

    const existing = accumulator.get(attempt.modality) ?? {
      attempts: 0,
      correct: 0,
    };
    existing.attempts += 1;
    if (attempt.is_correct) {
      existing.correct += 1;
    }
    accumulator.set(attempt.modality, existing);
    return accumulator;
  }, new Map());

  let strongestModality: VocabModality | null = null;
  let weakestModality: VocabModality | null = null;
  let strongestScore = -1;
  let weakestScore = Number.POSITIVE_INFINITY;

  for (const [modality, stats] of modalityStats.entries()) {
    const accuracy = stats.correct / stats.attempts;

    if (accuracy > strongestScore) {
      strongestScore = accuracy;
      strongestModality = modality;
    }

    if (accuracy < weakestScore) {
      weakestScore = accuracy;
      weakestModality = modality;
    }
  }

  return {
    attemptCount,
    recentAccuracy,
    averageResponseTimeMs,
    correctCount,
    incorrectCount,
    strongestModality,
    weakestModality,
  };
}

function isStrugglingCandidate(candidate: AdaptiveDifficultyCandidate) {
  const summary = summarizeAttempts(candidate.recentAttempts);

  return (
    candidate.lifecycleState === "weak_again" ||
    candidate.consecutiveIncorrect >= 2 ||
    summary.incorrectCount >= 2 ||
    (summary.recentAccuracy !== null && summary.recentAccuracy < 0.55) ||
    Number(candidate.masteryScore ?? 0) < 0.45
  );
}

function isFastAccurateCandidate(candidate: AdaptiveDifficultyCandidate) {
  const summary = summarizeAttempts(candidate.recentAttempts);

  return (
    summary.attemptCount >= 2 &&
    summary.recentAccuracy !== null &&
    summary.recentAccuracy >= 0.85 &&
    summary.averageResponseTimeMs !== null &&
    summary.averageResponseTimeMs <= 10000 &&
    candidate.consecutiveIncorrect === 0 &&
    Number(candidate.masteryScore ?? 0) >= 0.7
  );
}

function stepDifficulty(
  band: VocabDifficultyBand,
  direction: "easier" | "harder"
): VocabDifficultyBand {
  if (direction === "easier") {
    if (band === "hard") return "medium";
    if (band === "medium") return "easy";
    return "easy";
  }

  if (band === "easy") return "medium";
  if (band === "medium") return "hard";
  return "hard";
}

export function buildAdaptiveDifficultyProfile(
  candidates: AdaptiveDifficultyCandidate[]
): AdaptiveDifficultyProfile {
  const attempts = Array.from(
    new Map(
      candidates
        .flatMap((candidate) => candidate.recentAttempts)
        .map((attempt) => [attempt.id, attempt])
    ).values()
  )
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 30);
  const summary = summarizeAttempts(attempts);
  const strugglingWordCount = candidates.filter(isStrugglingCandidate).length;
  const fastAccurateWordCount = candidates.filter(isFastAccurateCandidate).length;
  const candidateCount = Math.max(candidates.length, 1);

  if (
    attempts.length >= 6 &&
    summary.recentAccuracy !== null &&
    summary.recentAccuracy >= 0.82 &&
    summary.averageResponseTimeMs !== null &&
    summary.averageResponseTimeMs <= 11000 &&
    strugglingWordCount <= Math.ceil(candidateCount * 0.25)
  ) {
    return {
      bias: "stretch",
      reason:
        "Recent vocabulary work has been fast and accurate, so this session can lean a bit more demanding.",
      recentAttemptCount: attempts.length,
      overallAccuracy: summary.recentAccuracy,
      averageResponseTimeMs: summary.averageResponseTimeMs,
      strugglingWordCount,
      fastAccurateWordCount,
    };
  }

  if (
    (summary.recentAccuracy !== null && summary.recentAccuracy <= 0.6) ||
    (summary.averageResponseTimeMs !== null && summary.averageResponseTimeMs >= 18000) ||
    strugglingWordCount >= Math.ceil(candidateCount * 0.35)
  ) {
    return {
      bias: "supportive",
      reason:
        "Recent vocabulary work shows more friction, so this session will bias toward reinforcement and easier entry points.",
      recentAttemptCount: attempts.length,
      overallAccuracy: summary.recentAccuracy,
      averageResponseTimeMs: summary.averageResponseTimeMs,
      strugglingWordCount,
      fastAccurateWordCount,
    };
  }

  return {
    bias: "balanced",
    reason:
      "Recent vocabulary work is stable enough to keep a balanced mix of supportive and stretch exercises.",
    recentAttemptCount: attempts.length,
    overallAccuracy: summary.recentAccuracy,
    averageResponseTimeMs: summary.averageResponseTimeMs,
    strugglingWordCount,
    fastAccurateWordCount,
  };
}

export function evaluateAdaptiveDifficulty(params: {
  candidate: AdaptiveDifficultyCandidate;
  selectionBucket: AdaptiveDifficultySelectionBucket;
  mode: "learn_new_words" | "review_weak_words" | "mixed_practice";
  profile: AdaptiveDifficultyProfile;
}): AdaptiveDifficultyDecision {
  const { candidate, selectionBucket, mode, profile } = params;
  const summary = summarizeAttempts(candidate.recentAttempts);
  const masteryScore = Number(candidate.masteryScore ?? 0);
  let difficultyBand: VocabDifficultyBand =
    candidate.currentDifficultyBand ??
    (selectionBucket === "weak_recent" || candidate.isNewWord ? "easy" : "medium");

  let reason =
    "Kept on a steady medium path because the recent signals look stable enough for regular progression.";
  let decisionRule: AdaptiveDifficultyDecision["decisionRule"] = "steady_progression";

  if (candidate.lessonFirstExposure || (candidate.isNewWord && candidate.sourceLessonId)) {
    difficultyBand = "easy";
    reason =
      "Kept on an easier intro path because this word is still closely tied to a recent lesson exposure.";
    decisionRule = "lesson_support_path";
  } else if (
    selectionBucket === "weak_recent" ||
    candidate.lifecycleState === "weak_again" ||
    candidate.consecutiveIncorrect >= 2 ||
    summary.incorrectCount >= 2 ||
    (summary.recentAccuracy !== null && summary.recentAccuracy < 0.5) ||
    masteryScore < 0.4
  ) {
    difficultyBand = "easy";
    reason =
      "Routed into a more supportive difficulty path because the word has been missed repeatedly or remains fragile.";
    decisionRule = "repeated_miss_support";
  } else if (
    selectionBucket === "retention_check" &&
    candidate.lifecycleState === "mastered" &&
    masteryScore >= 0.82 &&
    summary.incorrectCount === 0
  ) {
    difficultyBand = "hard";
    reason =
      "Routed into a harder retention check because the word already looks stable and can handle more context-heavy work.";
    decisionRule = "retention_stretch";
  } else if (
    profile.bias === "stretch" &&
    summary.recentAccuracy !== null &&
    summary.recentAccuracy >= 0.8 &&
    summary.averageResponseTimeMs !== null &&
    summary.averageResponseTimeMs <= 12000 &&
    candidate.consecutiveIncorrect === 0 &&
    masteryScore >= 0.68
  ) {
    difficultyBand = "hard";
    reason =
      "Routed into a harder path because recent performance on this word has been both accurate and fast.";
    decisionRule = "fast_accurate_stretch";
  } else if (
    profile.bias === "supportive" &&
    selectionBucket !== "retention_check" &&
    (summary.recentAccuracy === null || summary.recentAccuracy < 0.75)
  ) {
    difficultyBand = stepDifficulty(difficultyBand, "easier");
    reason =
      "Kept more supportive because the broader session profile suggests the student needs easier reinforcement right now.";
    decisionRule = "broad_support_bias";
  }

  if (mode === "learn_new_words" && difficultyBand === "hard") {
    difficultyBand = "medium";
  }

  if (mode === "review_weak_words" && selectionBucket === "weak_recent" && difficultyBand === "hard") {
    difficultyBand = "medium";
  }

  return {
    difficultyBand,
    reason,
    decisionRule,
    recentAccuracy: summary.recentAccuracy,
    averageResponseTimeMs: summary.averageResponseTimeMs,
    strongestModality: summary.strongestModality,
    weakestModality: summary.weakestModality,
  };
}

export function applyDifficultyToPreferredModality(params: {
  basePreferredModality: VocabModality;
  difficultyBand: VocabDifficultyBand;
  profileBias: SessionDifficultyBias;
  candidate: AdaptiveDifficultyCandidate;
  selectionBucket: AdaptiveDifficultySelectionBucket;
}) {
  const {
    basePreferredModality,
    difficultyBand,
    profileBias,
    candidate,
    selectionBucket,
  } = params;

  if (difficultyBand === "easy") {
    if (candidate.lessonFirstExposure || selectionBucket === "newer_words") {
      return "text" as const;
    }

    if (basePreferredModality === "audio") {
      return "text" as const;
    }

    if (basePreferredModality === "mixed") {
      return "context" as const;
    }

    return basePreferredModality === "context" ? "context" : "text";
  }

  if (difficultyBand === "hard") {
    if (basePreferredModality === "text") {
      return "context" as const;
    }

    if (basePreferredModality === "context" && profileBias === "stretch") {
      return "mixed" as const;
    }

    return basePreferredModality === "audio" ? "audio" : basePreferredModality;
  }

  if (profileBias === "stretch" && basePreferredModality === "text") {
    return "context" as const;
  }

  if (profileBias === "supportive" && basePreferredModality === "mixed") {
    return "context" as const;
  }

  return basePreferredModality;
}
