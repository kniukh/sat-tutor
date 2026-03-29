import {
  getExerciseDifficultyBand,
  getExerciseTargetWordId as readTargetWordId,
  type SupportedVocabExercise,
  type SupportedVocabExerciseType,
  type VocabExerciseQueueBucket,
} from "@/types/vocab-exercises";

export type VocabSessionMode =
  | "default_review"
  | "weak_first"
  | "mixed"
  | "learn_new_words"
  | "review_weak_words"
  | "mixed_practice";

export type VocabExerciseSession = {
  session_id: string;
  mode: VocabSessionMode;
  exercise_ids: string[];
  ordered_exercises: SupportedVocabExercise[];
  target_word_ids: string[];
  metadata: {
    requested_size: number;
    actual_size: number;
    counts_by_type: Partial<Record<SupportedVocabExerciseType, number>>;
    counts_by_bucket: Partial<Record<VocabExerciseQueueBucket, number>>;
    unique_target_words: number;
    repeated_target_words: number;
    dominant_bucket: VocabExerciseQueueBucket | null;
  };
};

type BuildSessionParams = {
  exercises: SupportedVocabExercise[];
  mode: VocabSessionMode;
  targetSize?: number;
  seed?: string;
};

const preferredTypeOrderByMode: Record<VocabSessionMode, SupportedVocabExerciseType[]> = {
  default_review: [
    "meaning_match",
    "fill_blank",
    "synonym",
    "context_meaning",
    "collocation",
  ],
  weak_first: [
    "meaning_match",
    "fill_blank",
    "context_meaning",
    "synonym",
    "collocation",
  ],
  mixed: [
    "meaning_match",
    "synonym",
    "fill_blank",
    "collocation",
    "context_meaning",
  ],
  learn_new_words: [
    "meaning_match",
    "synonym",
    "fill_blank",
    "collocation",
    "context_meaning",
  ],
  review_weak_words: [
    "meaning_match",
    "fill_blank",
    "context_meaning",
    "synonym",
    "collocation",
  ],
  mixed_practice: [
    "meaning_match",
    "fill_blank",
    "synonym",
    "context_meaning",
    "collocation",
  ],
};

const bucketPriorityOrderByMode: Record<VocabSessionMode, VocabExerciseQueueBucket[]> = {
  default_review: [
    "reinforcement",
    "scheduled",
    "overdue",
    "recently_failed",
    "weak_again",
  ],
  weak_first: [
    "recently_failed",
    "weak_again",
    "overdue",
    "reinforcement",
    "scheduled",
  ],
  mixed: [
    "recently_failed",
    "reinforcement",
    "weak_again",
    "overdue",
    "scheduled",
  ],
  learn_new_words: [
    "reinforcement",
    "scheduled",
    "overdue",
    "recently_failed",
    "weak_again",
  ],
  review_weak_words: [
    "recently_failed",
    "weak_again",
    "overdue",
    "reinforcement",
    "scheduled",
  ],
  mixed_practice: [
    "recently_failed",
    "weak_again",
    "reinforcement",
    "overdue",
    "scheduled",
  ],
};

const bucketTargetRatiosByMode: Record<
  VocabSessionMode,
  Partial<Record<VocabExerciseQueueBucket, number>>
> = {
  default_review: {
    reinforcement: 0.45,
    scheduled: 0.35,
    overdue: 0.15,
    recently_failed: 0.05,
  },
  weak_first: {
    recently_failed: 0.4,
    weak_again: 0.3,
    overdue: 0.2,
    reinforcement: 0.1,
  },
  mixed: {
    recently_failed: 0.2,
    reinforcement: 0.3,
    weak_again: 0.2,
    overdue: 0.2,
    scheduled: 0.1,
  },
  learn_new_words: {
    reinforcement: 0.6,
    scheduled: 0.4,
  },
  review_weak_words: {
    recently_failed: 0.4,
    weak_again: 0.3,
    overdue: 0.2,
    reinforcement: 0.1,
  },
  mixed_practice: {
    recently_failed: 0.3,
    weak_again: 0.25,
    reinforcement: 0.25,
    overdue: 0.15,
    scheduled: 0.05,
  },
};

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function deterministicWeight(seed: string, id: string) {
  return hashString(`${seed}:${id}`) / 4294967295;
}

function defaultTargetSize(mode: VocabSessionMode, poolSize: number) {
  const desired =
    mode === "learn_new_words"
      ? 6
      : mode === "review_weak_words" || mode === "weak_first"
        ? 8
        : mode === "default_review"
          ? 10
          : 7;
  return Math.min(desired, poolSize);
}

function desiredDifficultyForIndex(index: number, total: number) {
  if (total <= 1) return 2;
  const progress = index / Math.max(total - 1, 1);
  if (progress < 0.3) return 1.5;
  if (progress < 0.7) return 2.5;
  return 3;
}

function getNumericDifficulty(exercise: SupportedVocabExercise) {
  if (typeof exercise.difficulty === "number") {
    return exercise.difficulty;
  }

  const difficultyBand = getExerciseDifficultyBand(exercise);
  if (difficultyBand === "easy") return 1;
  if (difficultyBand === "medium") return 2;
  if (difficultyBand === "hard") return 3;
  return 2;
}

function countByType(items: SupportedVocabExercise[]) {
  return items.reduce<Partial<Record<SupportedVocabExerciseType, number>>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1;
    return acc;
  }, {});
}

function getQueueBucket(exercise: SupportedVocabExercise): VocabExerciseQueueBucket {
  return exercise.reviewMeta?.queueBucket ?? "scheduled";
}

function countByBucket(items: SupportedVocabExercise[]) {
  return items.reduce<Partial<Record<VocabExerciseQueueBucket, number>>>((acc, item) => {
    const bucket = getQueueBucket(item);
    acc[bucket] = (acc[bucket] ?? 0) + 1;
    return acc;
  }, {});
}

function dominantBucket(items: SupportedVocabExercise[]) {
  const counts = countByBucket(items);
  const order: VocabExerciseQueueBucket[] = [
    "recently_failed",
    "weak_again",
    "overdue",
    "reinforcement",
    "scheduled",
  ];

  return order.reduce<VocabExerciseQueueBucket | null>((current, bucket) => {
    if (!current) {
      return (counts[bucket] ?? 0) > 0 ? bucket : null;
    }

    return (counts[bucket] ?? 0) > (counts[current] ?? 0) ? bucket : current;
  }, null);
}

function getBucketTargets(mode: VocabSessionMode, requestedSize: number) {
  const ratios = bucketTargetRatiosByMode[mode];
  const order = bucketPriorityOrderByMode[mode];

  return order.reduce<Partial<Record<VocabExerciseQueueBucket, number>>>((acc, bucket) => {
    const ratio = ratios[bucket] ?? 0;
    acc[bucket] = Math.round(requestedSize * ratio);
    return acc;
  }, {});
}

function getImmediateWordRepeatPenalty(mode: VocabSessionMode) {
  if (mode === "review_weak_words" || mode === "weak_first") return 2;
  if (mode === "mixed" || mode === "mixed_practice") return 6;
  if (mode === "default_review") return 10;
  return 8;
}

function getRepeatedWordBonus(mode: VocabSessionMode) {
  if (mode === "review_weak_words" || mode === "weak_first") return 5;
  if (mode === "mixed" || mode === "mixed_practice") return 1;
  if (mode === "default_review") return -2;
  return -4;
}

function makeSessionId(mode: VocabSessionMode, seed: string) {
  return `vocab-session:${mode}:${hashString(seed).toString(36)}`;
}

function scoreCandidate(params: {
  candidate: SupportedVocabExercise;
  chosen: SupportedVocabExercise[];
  mode: VocabSessionMode;
  index: number;
  total: number;
  seed: string;
}) {
  const { candidate, chosen, mode, index, total, seed } = params;
  let score = 0;

  const preferredOrder = preferredTypeOrderByMode[mode];
  score += Math.max(0, 10 - preferredOrder.indexOf(candidate.type) * 2);

  const desiredDifficulty = desiredDifficultyForIndex(index, total);
  const candidateDifficulty = getNumericDifficulty(candidate);
  score -= Math.abs(candidateDifficulty - desiredDifficulty) * 2;

  const candidateBucket = getQueueBucket(candidate);
  const bucketPriorityOrder = bucketPriorityOrderByMode[mode];
  score += Math.max(0, 12 - bucketPriorityOrder.indexOf(candidateBucket) * 3);

  const bucketTargets = getBucketTargets(mode, total);
  const chosenBucketCount = chosen.filter(
    (item) => getQueueBucket(item) === candidateBucket
  ).length;
  const bucketTarget = bucketTargets[candidateBucket] ?? 0;

  if (bucketTarget > 0 && chosenBucketCount < bucketTarget) {
    score += 8;
  } else if (bucketTarget === 0 && mode !== "learn_new_words") {
    score -= 2;
  }

  const last = chosen[chosen.length - 1];
  const secondLast = chosen[chosen.length - 2];

  if (last?.type === candidate.type) score -= 6;
  if (last?.type === candidate.type && secondLast?.type === candidate.type) score -= 12;

  const candidateTargetWordId = readTargetWordId(candidate);
  const recentWords = chosen.slice(-2).map((item) => readTargetWordId(item));
  if (recentWords.includes(candidateTargetWordId)) {
    score -= getImmediateWordRepeatPenalty(mode);
  }

  const priorCountForWord = chosen.filter(
    (item) => readTargetWordId(item) === candidateTargetWordId
  ).length;

  if (priorCountForWord > 0) {
    score += getRepeatedWordBonus(mode);
  }

  if (
    (mode === "review_weak_words" || mode === "weak_first") &&
    priorCountForWord > 0 &&
    candidateBucket !== "scheduled"
  ) {
    score += 2;
  }

  if (mode !== "learn_new_words" && candidate.type === "context_meaning" && index >= 2) {
    score += 3;
  }

  if (mode === "learn_new_words" && index === total - 1 && candidate.type === "context_meaning") {
    score += 4;
  }

  score += deterministicWeight(seed, candidate.id);
  score += (candidate.reviewMeta?.queuePriorityScore ?? 0) * 4;
  return score;
}

export function buildVocabExerciseSession({
  exercises,
  mode,
  targetSize,
  seed = "default-seed",
}: BuildSessionParams): VocabExerciseSession {
  const requestedSize = targetSize ?? defaultTargetSize(mode, exercises.length);
  const uniquePool = Array.from(new Map(exercises.map((item) => [item.id, item])).values());
  const chosen: SupportedVocabExercise[] = [];
  const remaining = [...uniquePool];

  while (chosen.length < requestedSize && remaining.length > 0) {
    const scored = remaining
      .map((candidate) => ({
        candidate,
        score: scoreCandidate({
          candidate,
          chosen,
          mode,
          index: chosen.length,
          total: requestedSize,
          seed,
        }),
      }))
      .sort((a, b) => b.score - a.score);

    const next = scored[0]?.candidate;
    if (!next) break;

    chosen.push(next);

    const nextIndex = remaining.findIndex((item) => item.id === next.id);
    if (nextIndex >= 0) {
      remaining.splice(nextIndex, 1);
    }
  }

  const countsByType = countByType(chosen);
  const countsByBucket = countByBucket(chosen);
  const targetWordIds = chosen.map((item) => readTargetWordId(item));
  const uniqueTargetWords = new Set(targetWordIds).size;

  return {
    session_id: makeSessionId(mode, `${seed}:${requestedSize}:${uniquePool.length}`),
    mode,
    exercise_ids: chosen.map((item) => item.id),
    ordered_exercises: chosen,
    target_word_ids: targetWordIds,
    metadata: {
      requested_size: requestedSize,
      actual_size: chosen.length,
      counts_by_type: countsByType,
      counts_by_bucket: countsByBucket,
      unique_target_words: uniqueTargetWords,
      repeated_target_words: chosen.length - uniqueTargetWords,
      dominant_bucket: dominantBucket(chosen),
    },
  };
}
