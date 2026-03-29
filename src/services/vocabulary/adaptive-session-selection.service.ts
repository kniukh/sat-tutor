import {
  getExerciseModality,
  getExerciseTargetWord,
  getExerciseTargetWordId,
  type SupportedVocabExercise,
} from "@/types/vocab-exercises";
import {
  applyDifficultyToPreferredModality,
  buildAdaptiveDifficultyProfile,
  evaluateAdaptiveDifficulty,
  type AdaptiveDifficultyProfile,
  type SessionDifficultyBias,
} from "@/services/vocabulary/adaptive-difficulty.service";
import type {
  ExerciseAttemptRow,
  VocabDifficultyBand,
  VocabModality,
  WordLifecycleState,
} from "@/types/vocab-tracking";
import type { ReviewQueuePriorityBucket } from "@/services/vocabulary/review-queue.service";
import type { VocabExerciseSourceType } from "@/types/vocab-exercises";

export type AdaptiveVocabularyMode =
  | "learn_new_words"
  | "review_weak_words"
  | "mixed_practice";

export type AdaptiveSelectionBucket =
  | "weak_recent"
  | "reinforcement"
  | "newer_words"
  | "retention_check";

export type AdaptiveWordCandidate = {
  wordId: string;
  word: string;
  exercises: SupportedVocabExercise[];
  lifecycleState: WordLifecycleState | null;
  masteryScore: number | null;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  currentDifficultyBand: VocabDifficultyBand | null;
  nextReviewAt: string | null;
  lastSeenAt: string | null;
  lastModality: VocabModality | null;
  queueBucket: ReviewQueuePriorityBucket | null;
  queueReason: string | null;
  queuePriorityScore: number | null;
  recommendedModality: VocabModality | null;
  recentAttempts: ExerciseAttemptRow[];
  isNewWord: boolean;
  sourceLessonId: string | null;
  sourceLessonTitle: string | null;
  sourcePassageTitle: string | null;
  sourceContextSnippet: string | null;
  sourceCapturedAt: string | null;
  sourceType: VocabExerciseSourceType | null;
  lessonFirstExposure: boolean;
};

export type AdaptiveSelectionWordSummary = {
  wordId: string;
  word: string;
  bucket: AdaptiveSelectionBucket;
  preferredModality: VocabModality;
  selectionRule: string;
  reason: string;
  score: number;
  adaptiveDifficultyBand: VocabDifficultyBand;
  adaptiveDifficultyReason: string;
  sessionDifficultyBias: SessionDifficultyBias;
  recentAccuracy: number | null;
  averageResponseTimeMs: number | null;
  strongestModality: VocabModality | null;
  weakestModality: VocabModality | null;
  queueBucket: ReviewQueuePriorityBucket | null;
  queueReason: string | null;
  lifecycleState: WordLifecycleState | null;
  masteryScore: number | null;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  recentIncorrectCount: number;
  lastModality: VocabModality | null;
  recommendedModality: VocabModality | null;
  sourceLessonId: string | null;
  sourceLessonTitle: string | null;
  sourcePassageTitle: string | null;
  sourceContextSnippet: string | null;
  sourceType: VocabExerciseSourceType | null;
  lessonFirstExposure: boolean;
};

export type AdaptiveSessionSelectionSummary = {
  targetSize: number;
  targetMix: Record<AdaptiveSelectionBucket, number>;
  countsByBucket: Partial<Record<AdaptiveSelectionBucket, number>>;
  countsByModality: Partial<Record<VocabModality, number>>;
  countsByDifficulty: Partial<Record<VocabDifficultyBand, number>>;
  difficultyProfile: AdaptiveDifficultyProfile;
  selectedWords: AdaptiveSelectionWordSummary[];
};

export type AdaptiveSessionSelectionResult = {
  selectedWordIds: string[];
  summary: AdaptiveSessionSelectionSummary;
};

const MODE_BUCKET_TARGETS: Record<
  AdaptiveVocabularyMode,
  Record<AdaptiveSelectionBucket, number>
> = {
  mixed_practice: {
    weak_recent: 0.4,
    reinforcement: 0.25,
    newer_words: 0.2,
    retention_check: 0.15,
  },
  review_weak_words: {
    weak_recent: 0.55,
    reinforcement: 0.25,
    newer_words: 0.05,
    retention_check: 0.15,
  },
  learn_new_words: {
    weak_recent: 0.05,
    reinforcement: 0.2,
    newer_words: 0.6,
    retention_check: 0.15,
  },
};

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function deterministicWeight(seed: string, value: string) {
  return hashString(`${seed}:${value}`) / 4294967295;
}

function countRecentIncorrectAttempts(attempts: ExerciseAttemptRow[], now: Date) {
  return attempts.filter((attempt) => {
    if (attempt.is_correct) {
      return false;
    }

    const attemptTime = new Date(attempt.created_at).getTime();
    return now.getTime() - attemptTime <= 1000 * 60 * 60 * 72;
  }).length;
}

function isRecentLessonEncounter(candidate: AdaptiveWordCandidate, now: Date) {
  if (!candidate.sourceLessonId || !candidate.sourceCapturedAt) {
    return false;
  }

  const capturedAt = new Date(candidate.sourceCapturedAt);
  return now.getTime() - capturedAt.getTime() <= 1000 * 60 * 60 * 24 * 7;
}

function inferAdaptiveBucket(candidate: AdaptiveWordCandidate, now: Date): AdaptiveSelectionBucket {
  const isOverdue = candidate.nextReviewAt
    ? new Date(candidate.nextReviewAt).getTime() <= now.getTime()
    : false;
  const recentIncorrectCount = countRecentIncorrectAttempts(candidate.recentAttempts, now);

  if (
    candidate.isNewWord ||
    (!candidate.lifecycleState && candidate.recentAttempts.length === 0)
  ) {
    return "newer_words";
  }

  if (
    recentIncorrectCount > 0 ||
    candidate.lifecycleState === "weak_again" ||
    candidate.queueBucket === "recently_failed" ||
    candidate.queueBucket === "weak_again"
  ) {
    return "weak_recent";
  }

  if (
    candidate.lifecycleState === "mastered" ||
    candidate.queueReason === "mastery_maintenance"
  ) {
    return "retention_check";
  }

  if (
    candidate.lifecycleState === "learning" ||
    candidate.lifecycleState === "new" ||
    candidate.lifecycleState === "review" ||
    candidate.queueBucket === "reinforcement" ||
    candidate.queueBucket === "overdue" ||
    isOverdue
  ) {
    return "reinforcement";
  }

  return "retention_check";
}

function getBasePreferredModality(
  candidate: AdaptiveWordCandidate,
  bucket: AdaptiveSelectionBucket
) {
  if (candidate.recommendedModality) {
    return candidate.recommendedModality;
  }

  if (bucket === "newer_words") {
    if (candidate.sourceLessonId) {
      return "text" as const;
    }
    return "text" as const;
  }

  if (bucket === "weak_recent") {
    if (candidate.lastModality === "text") return "context" as const;
    if (candidate.lastModality === "context") return "text" as const;
    return "mixed" as const;
  }

  if (bucket === "reinforcement") {
    if (candidate.lessonFirstExposure && candidate.sourceLessonId) {
      return "context" as const;
    }
    if (candidate.lastModality === "text") return "context" as const;
    return candidate.lastModality ?? "context";
  }

  return candidate.lastModality ?? "mixed";
}

function makeSelectionReason(params: {
  candidate: AdaptiveWordCandidate;
  bucket: AdaptiveSelectionBucket;
  preferredModality: VocabModality;
  recentIncorrectCount: number;
}) {
  const { candidate, bucket, preferredModality, recentIncorrectCount } = params;

  if (bucket === "weak_recent") {
    if (candidate.lifecycleState === "weak_again") {
      return "Surfaced early because the word relapsed after prior mastery.";
    }

    if (recentIncorrectCount > 0) {
      return `Surfaced early because it was answered incorrectly ${recentIncorrectCount} time(s) recently.`;
    }

    return "Surfaced early because the review queue marks it as high-pressure recovery work.";
  }

  if (bucket === "reinforcement") {
    if (candidate.lessonFirstExposure && candidate.sourceLessonTitle) {
      return `Included for reinforcement because it first appeared in ${candidate.sourceLessonTitle} and is now being stabilized with ${preferredModality}.`;
    }
    return `Included for reinforcement because it is still in ${candidate.lifecycleState ?? "review"} and leans toward ${preferredModality}.`;
  }

  if (bucket === "newer_words") {
    if (candidate.sourceLessonTitle) {
      const passageNote = candidate.sourcePassageTitle
        ? `, especially the passage "${candidate.sourcePassageTitle}"`
        : "";
      return `Included as a fresh lesson word from ${candidate.sourceLessonTitle}${passageNote} so Vocabulary Studio still feels connected to the original reading context.`;
    }
    return "Included as a newer word so the session introduces fresh vocabulary, then stabilizes it with a simpler modality.";
  }

  return "Included as a lighter retention check so mastered vocabulary still gets occasional maintenance.";
}

function getSelectionRule(params: {
  candidate: AdaptiveWordCandidate;
  bucket: AdaptiveSelectionBucket;
}) {
  const { candidate, bucket } = params;

  if (bucket === "newer_words") {
    return candidate.sourceLessonId ? "lesson_word_intro" : "new_word_intro";
  }

  if (bucket === "weak_recent" || candidate.lifecycleState === "weak_again") {
    return "weak_word_retry";
  }

  if (bucket === "reinforcement") {
    return "learning_reinforcement";
  }

  return "retention_check";
}

function clampBucketTarget(total: number, ratio: number) {
  return Math.max(0, Math.round(total * ratio));
}

function buildTargetMix(mode: AdaptiveVocabularyMode, targetSize: number) {
  const ratios = MODE_BUCKET_TARGETS[mode];
  const mix = {
    weak_recent: clampBucketTarget(targetSize, ratios.weak_recent),
    reinforcement: clampBucketTarget(targetSize, ratios.reinforcement),
    newer_words: clampBucketTarget(targetSize, ratios.newer_words),
    retention_check: clampBucketTarget(targetSize, ratios.retention_check),
  };

  let allocated =
    mix.weak_recent + mix.reinforcement + mix.newer_words + mix.retention_check;
  const order: AdaptiveSelectionBucket[] = [
    "weak_recent",
    "reinforcement",
    "newer_words",
    "retention_check",
  ];

  let pointer = 0;
  while (allocated < targetSize) {
    const bucket = order[pointer % order.length];
    mix[bucket] += 1;
    allocated += 1;
    pointer += 1;
  }

  while (allocated > targetSize) {
    const bucket = order[pointer % order.length];
    if (mix[bucket] > 0) {
      mix[bucket] -= 1;
      allocated -= 1;
    }
    pointer += 1;
  }

  return mix;
}

function scoreWordCandidate(params: {
  candidate: AdaptiveWordCandidate;
  bucket: AdaptiveSelectionBucket;
  preferredModality: VocabModality;
  adaptiveDifficultyBand: VocabDifficultyBand;
  sessionDifficultyBias: SessionDifficultyBias;
  seed: string;
  now: Date;
}) {
  const {
    candidate,
    bucket,
    preferredModality,
    adaptiveDifficultyBand,
    sessionDifficultyBias,
    seed,
    now,
  } = params;
  const recentIncorrectCount = countRecentIncorrectAttempts(candidate.recentAttempts, now);
  let score = 0;
  const recentLessonEncounter = isRecentLessonEncounter(candidate, now);

  if (bucket === "weak_recent") {
    score += 20;
  } else if (bucket === "reinforcement") {
    score += 12;
  } else if (bucket === "newer_words") {
    score += 9;
  } else {
    score += 6;
  }

  score += recentIncorrectCount * 6;
  score += Math.min(candidate.consecutiveIncorrect * 3, 9);
  score += (candidate.queuePriorityScore ?? 0) * 10;
  score += Math.max(0, 1 - Number(candidate.masteryScore ?? 0)) * 6;

  if (candidate.queueBucket === "recently_failed") score += 8;
  if (candidate.queueBucket === "weak_again") score += 10;
  if (candidate.queueBucket === "overdue") score += 5;
  if (candidate.lifecycleState === "mastered") score -= 2;
  if (candidate.sourceLessonId) score += 2;
  if (candidate.sourceType === "reading_lesson") score += 2;
  if (candidate.lessonFirstExposure) score += 3;
  if (recentLessonEncounter) score += 5;
  if (bucket === "newer_words" && candidate.sourceContextSnippet) score += 2;
  if (bucket === "newer_words" && candidate.sourcePassageTitle) score += 1;
  if (adaptiveDifficultyBand === "easy" && bucket !== "retention_check") score += 2;
  if (adaptiveDifficultyBand === "hard" && bucket === "retention_check") score += 3;
  if (adaptiveDifficultyBand === "hard" && sessionDifficultyBias === "stretch") score += 2;
  if (adaptiveDifficultyBand === "easy" && sessionDifficultyBias === "supportive") score += 2;

  if (preferredModality !== candidate.lastModality && candidate.lastModality) {
    score += 2;
  }

  score += deterministicWeight(seed, candidate.wordId);
  return Number(score.toFixed(4));
}

function addSummaryCount<T extends string>(
  record: Partial<Record<T, number>>,
  key: T,
  amount: number = 1
) {
  record[key] = (record[key] ?? 0) + amount;
}

export function selectAdaptiveSessionExercises(params: {
  mode: AdaptiveVocabularyMode;
  candidates: AdaptiveWordCandidate[];
  targetSize: number;
  seed: string;
  now?: Date;
}): AdaptiveSessionSelectionResult {
  const now = params.now ?? new Date();
  const targetMix = buildTargetMix(params.mode, params.targetSize);
  const availableByBucket = new Map<AdaptiveSelectionBucket, AdaptiveWordCandidate[]>();

  for (const candidate of params.candidates) {
    const bucket = inferAdaptiveBucket(candidate, now);
    const list = availableByBucket.get(bucket) ?? [];
    list.push(candidate);
    availableByBucket.set(bucket, list);
  }

  const selectedWordIds: string[] = [];
  const selectedWords = new Set<string>();
  const difficultyProfile = buildAdaptiveDifficultyProfile(params.candidates);
  const summary: AdaptiveSessionSelectionSummary = {
    targetSize: params.targetSize,
    targetMix,
    countsByBucket: {},
    countsByModality: {},
    countsByDifficulty: {},
    difficultyProfile,
    selectedWords: [],
  };

  const bucketOrder: AdaptiveSelectionBucket[] = [
    "weak_recent",
    "reinforcement",
    "newer_words",
    "retention_check",
  ];

  for (const bucket of bucketOrder) {
    const bucketCandidates = (availableByBucket.get(bucket) ?? [])
      .map((candidate) => {
        const basePreferredModality = getBasePreferredModality(candidate, bucket);
        const difficultyDecision = evaluateAdaptiveDifficulty({
          candidate,
          selectionBucket: bucket,
          mode: params.mode,
          profile: difficultyProfile,
        });
        const preferredModality = applyDifficultyToPreferredModality({
          basePreferredModality,
          difficultyBand: difficultyDecision.difficultyBand,
          profileBias: difficultyProfile.bias,
          candidate,
          selectionBucket: bucket,
        });
        return {
          candidate,
          preferredModality,
          difficultyDecision,
          score: scoreWordCandidate({
            candidate,
            bucket,
            preferredModality,
            adaptiveDifficultyBand: difficultyDecision.difficultyBand,
            sessionDifficultyBias: difficultyProfile.bias,
            seed: params.seed,
            now,
          }),
        };
      })
      .sort((left, right) => right.score - left.score);

    const targetCount = targetMix[bucket];

    for (const entry of bucketCandidates) {
      if (selectedWordIds.length >= params.targetSize) {
        break;
      }

      if (summary.selectedWords.length >= params.targetSize) {
        break;
      }

      if (selectedWords.has(entry.candidate.wordId)) {
        continue;
      }

      if ((summary.countsByBucket[bucket] ?? 0) >= targetCount) {
        break;
      }

      const recentIncorrectCount = countRecentIncorrectAttempts(entry.candidate.recentAttempts, now);
      const reason = makeSelectionReason({
        candidate: entry.candidate,
        bucket,
        preferredModality: entry.preferredModality,
        recentIncorrectCount,
      });
      const selectionRule = getSelectionRule({
        candidate: entry.candidate,
        bucket,
      });

      selectedWordIds.push(entry.candidate.wordId);
      selectedWords.add(entry.candidate.wordId);
      addSummaryCount(summary.countsByBucket, bucket);
      addSummaryCount(summary.countsByModality, entry.preferredModality);
      addSummaryCount(summary.countsByDifficulty, entry.difficultyDecision.difficultyBand);
      summary.selectedWords.push({
        wordId: entry.candidate.wordId,
        word: entry.candidate.word,
        bucket,
        preferredModality: entry.preferredModality,
        selectionRule,
        reason,
        score: entry.score,
        adaptiveDifficultyBand: entry.difficultyDecision.difficultyBand,
        adaptiveDifficultyReason: entry.difficultyDecision.reason,
        sessionDifficultyBias: difficultyProfile.bias,
        recentAccuracy: entry.difficultyDecision.recentAccuracy,
        averageResponseTimeMs: entry.difficultyDecision.averageResponseTimeMs,
        strongestModality: entry.difficultyDecision.strongestModality,
        weakestModality: entry.difficultyDecision.weakestModality,
        queueBucket: entry.candidate.queueBucket,
        queueReason: entry.candidate.queueReason,
        lifecycleState: entry.candidate.lifecycleState,
        masteryScore: entry.candidate.masteryScore,
        consecutiveCorrect: entry.candidate.consecutiveCorrect,
        consecutiveIncorrect: entry.candidate.consecutiveIncorrect,
        recentIncorrectCount,
        lastModality: entry.candidate.lastModality,
        recommendedModality: entry.candidate.recommendedModality,
        sourceLessonId: entry.candidate.sourceLessonId,
        sourceLessonTitle: entry.candidate.sourceLessonTitle,
        sourcePassageTitle: entry.candidate.sourcePassageTitle,
        sourceContextSnippet: entry.candidate.sourceContextSnippet,
        sourceType: entry.candidate.sourceType,
        lessonFirstExposure: entry.candidate.lessonFirstExposure,
      });
    }
  }

  if (selectedWordIds.length < params.targetSize) {
    const fallback = params.candidates
      .filter((candidate) => !selectedWords.has(candidate.wordId))
      .map((candidate) => {
        const bucket = inferAdaptiveBucket(candidate, now);
        const basePreferredModality = getBasePreferredModality(candidate, bucket);
        const difficultyDecision = evaluateAdaptiveDifficulty({
          candidate,
          selectionBucket: bucket,
          mode: params.mode,
          profile: difficultyProfile,
        });
        const preferredModality = applyDifficultyToPreferredModality({
          basePreferredModality,
          difficultyBand: difficultyDecision.difficultyBand,
          profileBias: difficultyProfile.bias,
          candidate,
          selectionBucket: bucket,
        });
        return {
          candidate,
          bucket,
          preferredModality,
          difficultyDecision,
          score: scoreWordCandidate({
            candidate,
            bucket,
            preferredModality,
            adaptiveDifficultyBand: difficultyDecision.difficultyBand,
            sessionDifficultyBias: difficultyProfile.bias,
            seed: `${params.seed}:fallback`,
            now,
          }),
        };
      })
      .sort((left, right) => right.score - left.score);

    for (const entry of fallback) {
      if (selectedWordIds.length >= params.targetSize) {
        break;
      }

      const recentIncorrectCount = countRecentIncorrectAttempts(entry.candidate.recentAttempts, now);
      const reason = makeSelectionReason({
        candidate: entry.candidate,
        bucket: entry.bucket,
        preferredModality: entry.preferredModality,
        recentIncorrectCount,
      });
      const selectionRule = getSelectionRule({
        candidate: entry.candidate,
        bucket: entry.bucket,
      });

      selectedWordIds.push(entry.candidate.wordId);
      selectedWords.add(entry.candidate.wordId);
      addSummaryCount(summary.countsByBucket, entry.bucket);
      addSummaryCount(summary.countsByModality, entry.preferredModality);
      addSummaryCount(summary.countsByDifficulty, entry.difficultyDecision.difficultyBand);
      summary.selectedWords.push({
        wordId: entry.candidate.wordId,
        word: entry.candidate.word,
        bucket: entry.bucket,
        preferredModality: entry.preferredModality,
        selectionRule,
        reason,
        score: entry.score,
        adaptiveDifficultyBand: entry.difficultyDecision.difficultyBand,
        adaptiveDifficultyReason: entry.difficultyDecision.reason,
        sessionDifficultyBias: difficultyProfile.bias,
        recentAccuracy: entry.difficultyDecision.recentAccuracy,
        averageResponseTimeMs: entry.difficultyDecision.averageResponseTimeMs,
        strongestModality: entry.difficultyDecision.strongestModality,
        weakestModality: entry.difficultyDecision.weakestModality,
        queueBucket: entry.candidate.queueBucket,
        queueReason: entry.candidate.queueReason,
        lifecycleState: entry.candidate.lifecycleState,
        masteryScore: entry.candidate.masteryScore,
        consecutiveCorrect: entry.candidate.consecutiveCorrect,
        consecutiveIncorrect: entry.candidate.consecutiveIncorrect,
        recentIncorrectCount,
        lastModality: entry.candidate.lastModality,
        recommendedModality: entry.candidate.recommendedModality,
        sourceLessonId: entry.candidate.sourceLessonId,
        sourceLessonTitle: entry.candidate.sourceLessonTitle,
        sourcePassageTitle: entry.candidate.sourcePassageTitle,
        sourceContextSnippet: entry.candidate.sourceContextSnippet,
        sourceType: entry.candidate.sourceType,
        lessonFirstExposure: entry.candidate.lessonFirstExposure,
      });
    }
  }

  return {
    selectedWordIds,
    summary,
  };
}

export function groupExercisesByWord(exercises: SupportedVocabExercise[]) {
  return exercises.reduce<Map<string, SupportedVocabExercise[]>>((accumulator, exercise) => {
    const wordId = getExerciseTargetWordId(exercise);
    const key = wordId || getExerciseTargetWord(exercise) || exercise.id;
    const existing = accumulator.get(key) ?? [];
    existing.push(exercise);
    accumulator.set(key, existing);
    return accumulator;
  }, new Map());
}
