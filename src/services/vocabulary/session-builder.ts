import {
  getExerciseAudioStatus,
  getExerciseDifficultyBand,
  getExerciseModality,
  getExerciseTargetWord,
  getExerciseTargetWordId as readTargetWordId,
  type SupportedVocabExercise,
  type SupportedVocabExerciseType,
  type VocabularyContinuationSourceBucket,
  type VocabularySessionPhase,
  type VocabExerciseSourceType,
  type VocabExerciseQueueBucket,
} from "@/types/vocab-exercises";
import type { VocabModality, WordLifecycleState } from "@/types/vocab-tracking";
import {
  SESSION_DEFAULT_DIFFICULTY_BY_TYPE,
  SESSION_DIFFICULTY_BIAS_SHIFT,
  SESSION_DIFFICULTY_TARGET_BY_BAND,
  SESSION_TYPE_ORDER_BY_ADAPTIVE_DIFFICULTY,
  resolveSessionProgressionRule,
  SESSION_BUCKET_PRIORITY_ORDER_BY_MODE,
  SESSION_BUCKET_TARGET_RATIOS_BY_MODE,
  SESSION_PREFERRED_TYPE_ORDER_BY_MODE,
  resolveSessionTouchPolicy,
  type VocabularyLearningFamily,
} from "@/services/vocabulary/session-builder.config";

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
    counts_by_difficulty: Partial<Record<"easy" | "medium" | "hard", number>>;
    counts_by_rule: Record<string, number>;
    unique_target_words: number;
    repeated_target_words: number;
    anchor_word_target: number;
    anchor_word_count: number;
    support_word_count: number;
    words_seen_once: number;
    words_seen_twice: number;
    words_seen_three_plus: number;
    total_interactions: number;
    reinforcement_budget: number;
    grouped_support_budget: number;
    rotation_recipe: "recognition_audio" | "context_sat" | "production_precision";
    forced_type_slots: SupportedVocabExerciseType[];
    dominant_bucket: VocabExerciseQueueBucket | null;
    session_phase: VocabularySessionPhase;
    extended_practice_mode: boolean;
    continuation_available: boolean;
    checkpoint_index: number;
    continuation_source_counts: Partial<Record<VocabularyContinuationSourceBucket, number>>;
    sequence_debug: Array<{
      index: number;
      exercise_id: string;
      target_word_id: string;
      target_word: string;
      exercise_type: SupportedVocabExerciseType;
      queue_bucket: VocabExerciseQueueBucket;
      continuation_source_bucket: VocabularyContinuationSourceBucket | null;
      session_phase: VocabularySessionPhase;
      lifecycle_state: WordLifecycleState | null;
      preferred_modality: VocabModality | null;
      selection_rule: string | null;
      selection_reason: string | null;
      source_lesson_id: string | null;
      source_lesson_title: string | null;
      source_passage_title: string | null;
      source_context_snippet: string | null;
      source_type: VocabExerciseSourceType | null;
      adaptive_difficulty_band: "easy" | "medium" | "hard" | null;
      adaptive_difficulty_reason: string | null;
      session_difficulty_bias: "supportive" | "balanced" | "stretch" | null;
      session_role:
        | "anchor_primary"
        | "anchor_reinforcement"
        | "anchor_risk_reinforcement"
        | "grouped_support"
        | "fallback";
      learning_family: VocabularyLearningFamily;
      touch_number: number;
      grouped_support_word_ids: string[];
      triggered_by: string;
    }>;
  };
};

type BuildSessionParams = {
  exercises: SupportedVocabExercise[];
  mode: VocabSessionMode;
  phase?: VocabularySessionPhase;
  continuationAvailable?: boolean;
  targetSize?: number;
  seed?: string;
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

function getAvailableTypeOrder(exercises: SupportedVocabExercise[], mode: VocabSessionMode) {
  const availableTypes = new Set(exercises.map((exercise) => exercise.type));
  return SESSION_PREFERRED_TYPE_ORDER_BY_MODE[mode].filter((type) =>
    availableTypes.has(type)
  );
}

function desiredDifficultyForIndex(
  index: number,
  total: number,
  bias: "supportive" | "balanced" | "stretch"
) {
  if (total <= 1) return 2;
  const progress = index / Math.max(total - 1, 1);
  const shift = SESSION_DIFFICULTY_BIAS_SHIFT[bias];
  if (progress < 0.3) return 1.5 + shift;
  if (progress < 0.7) return 2.5 + shift;
  return 3 + shift;
}

function getNumericDifficulty(exercise: SupportedVocabExercise) {
  if (typeof exercise.difficulty === "number") {
    return exercise.difficulty;
  }

  const difficultyBand = getExerciseDifficultyBand(exercise);
  if (difficultyBand === "easy") return 1;
  if (difficultyBand === "medium") return 2;
  if (difficultyBand === "hard") return 3;
  return SESSION_DEFAULT_DIFFICULTY_BY_TYPE[exercise.type] ?? 2;
}

function getTypeOrderScore(
  orderedTypes: SupportedVocabExerciseType[],
  exerciseType: SupportedVocabExerciseType,
  maxScore: number
) {
  const index = orderedTypes.indexOf(exerciseType);
  return index >= 0 ? Math.max(0, maxScore - index * 2) : -6;
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

function countByDifficulty(items: SupportedVocabExercise[]) {
  return items.reduce<Partial<Record<"easy" | "medium" | "hard", number>>>((acc, item) => {
    const band = item.reviewMeta?.adaptiveDifficultyBand ?? getExerciseDifficultyBand(item);
    if (!band) {
      return acc;
    }

    acc[band] = (acc[band] ?? 0) + 1;
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
  const ratios = SESSION_BUCKET_TARGET_RATIOS_BY_MODE[mode];
  const order = SESSION_BUCKET_PRIORITY_ORDER_BY_MODE[mode];

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

type SessionRotationRecipeId =
  | "recognition_audio"
  | "context_sat"
  | "production_precision";

type SessionRotationRecipe = {
  id: SessionRotationRecipeId;
  anchorTypeSlots: SupportedVocabExerciseType[];
  reinforcementTypeSlots: SupportedVocabExerciseType[];
};

const SESSION_ROTATION_RECIPES: SessionRotationRecipe[] = [
  {
    id: "recognition_audio",
    anchorTypeSlots: [
      "meaning_match",
      "translation_match",
      "listen_match",
      "spelling_from_audio",
      "context_meaning",
      "fill_blank",
      "synonym",
      "collocation",
    ],
    reinforcementTypeSlots: [
      "context_meaning",
      "spelling_from_audio",
      "synonym",
      "fill_blank",
    ],
  },
  {
    id: "context_sat",
    anchorTypeSlots: [
      "context_meaning",
      "fill_blank",
      "synonym",
      "collocation",
      "spelling_from_audio",
      "translation_match",
      "listen_match",
    ],
    reinforcementTypeSlots: [
      "sentence_builder",
      "collocation",
      "synonym",
    ],
  },
  {
    id: "production_precision",
    anchorTypeSlots: [
      "sentence_builder",
      "fill_blank",
      "collocation",
      "listen_match",
      "synonym",
      "spelling_from_audio",
      "context_meaning",
    ],
    reinforcementTypeSlots: [
      "sentence_builder",
      "spelling_from_audio",
      "context_meaning",
    ],
  },
];

function resolveSessionRotationRecipe(seed: string) {
  return SESSION_ROTATION_RECIPES[hashString(seed) % SESSION_ROTATION_RECIPES.length];
}

function getRequiredTypeSlot(
  slots: SupportedVocabExerciseType[],
  index: number
) {
  return slots[index % Math.max(1, slots.length)] ?? null;
}

function getSelectionBucket(exercise: SupportedVocabExercise) {
  return exercise.reviewMeta?.selectionBucket ?? "reinforcement";
}

function getLifecycleState(exercise: SupportedVocabExercise) {
  return exercise.reviewMeta?.lifecycleState ?? null;
}

function getPreferredModality(exercise: SupportedVocabExercise) {
  return exercise.reviewMeta?.preferredModality ?? null;
}

function getSelectionRule(exercise: SupportedVocabExercise) {
  return exercise.reviewMeta?.selectionRule ?? null;
}

function getSelectionReason(exercise: SupportedVocabExercise) {
  return exercise.reviewMeta?.selectionReason ?? null;
}

function getAdaptiveDifficultyBand(exercise: SupportedVocabExercise) {
  return (
    exercise.reviewMeta?.adaptiveDifficultyBand ??
    getExerciseDifficultyBand(exercise) ??
    "medium"
  );
}

function getAdaptiveDifficultyReason(exercise: SupportedVocabExercise) {
  return exercise.reviewMeta?.adaptiveDifficultyReason ?? null;
}

function getSessionDifficultyBias(exercise: SupportedVocabExercise) {
  return exercise.reviewMeta?.sessionDifficultyBias ?? "balanced";
}

function getListenMatchVariant(exercise: SupportedVocabExercise) {
  if (exercise.type !== "listen_match") {
    return null;
  }

  return "variant" in exercise && typeof exercise.variant === "string"
    ? exercise.variant
    : null;
}

type SessionSequenceRole =
  | "anchor_primary"
  | "anchor_reinforcement"
  | "anchor_risk_reinforcement"
  | "grouped_support"
  | "fallback";

function getMetadataStringArray(
  exercise: SupportedVocabExercise,
  key: string
): string[] {
  const value = exercise.metadata?.[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function getCoveredWordIds(exercise: SupportedVocabExercise) {
  const groupedWordIds = getMetadataStringArray(exercise, "pair_target_word_ids");
  if (groupedWordIds.length > 0) {
    return Array.from(new Set(groupedWordIds));
  }

  const targetWordId = readTargetWordId(exercise);
  return targetWordId ? [targetWordId] : [];
}

function isGroupedSupportExercise(exercise: SupportedVocabExercise) {
  if (exercise.type === "pair_match") {
    return true;
  }

  return exercise.type === "listen_match" && getCoveredWordIds(exercise).length > 1;
}

function getLearningFamily(exercise: SupportedVocabExercise): VocabularyLearningFamily {
  if (isGroupedSupportExercise(exercise)) {
    return "grouped_support";
  }

  if (exercise.type === "meaning_match" || exercise.type === "translation_match") {
    return "recognition";
  }

  if (exercise.type === "listen_match" || exercise.type === "spelling_from_audio") {
    return "audio_form";
  }

  return "context_semantic";
}

function canUseAsAnchorTouch(exercise: SupportedVocabExercise) {
  return getLearningFamily(exercise) !== "grouped_support";
}

type WordExerciseEntry = {
  wordId: string;
  word: string;
  exercises: SupportedVocabExercise[];
};

function groupExercisesByWord(exercises: SupportedVocabExercise[]) {
  const groups = new Map<string, WordExerciseEntry>();

  for (const exercise of exercises) {
    const wordId = readTargetWordId(exercise) || exercise.id;
    const existing = groups.get(wordId);

    if (existing) {
      existing.exercises.push(exercise);
      continue;
    }

    groups.set(wordId, {
      wordId,
      word: getExerciseTargetWord(exercise),
      exercises: [exercise],
    });
  }

  return Array.from(groups.values());
}

function getProgressionPlan(entry: WordExerciseEntry, mode: VocabSessionMode) {
  const reference = entry.exercises[0];
  return resolveSessionProgressionRule({
    mode,
    lifecycleState: getLifecycleState(reference),
    selectionBucket: getSelectionBucket(reference),
    selectionRule: getSelectionRule(reference),
  });
}

function getDesiredProgressionIndex(index: number, total: number) {
  if (total <= 1) return 0;
  const progress = index / Math.max(total - 1, 1);
  if (progress < 0.34) return 0;
  if (progress < 0.67) return 1;
  return 2;
}

function chooseExerciseForWordEntry(params: {
  entry: WordExerciseEntry;
  chosen: SupportedVocabExercise[];
  mode: VocabSessionMode;
  index: number;
  total: number;
  seed: string;
  requiredType?: SupportedVocabExerciseType;
  requiredFamily?: VocabularyLearningFamily;
  excludedExerciseIds?: Set<string>;
  allowGroupedSupport?: boolean;
}) {
  const {
    entry,
    chosen,
    mode,
    index,
    total,
    seed,
    requiredType,
    requiredFamily,
    excludedExerciseIds,
    allowGroupedSupport = false,
  } = params;
  const progression = getProgressionPlan(entry, mode);
  const desiredProgressionIndex = getDesiredProgressionIndex(index, total);
  const desiredType = progression.types[Math.min(desiredProgressionIndex, progression.types.length - 1)];
  const preferredOrder = SESSION_PREFERRED_TYPE_ORDER_BY_MODE[mode];
  const last = chosen[chosen.length - 1];
  const secondLast = chosen[chosen.length - 2];

  const scoredChoices = entry.exercises
    .filter((candidate) => {
      if (excludedExerciseIds?.has(candidate.id)) {
        return false;
      }

      if (!allowGroupedSupport && isGroupedSupportExercise(candidate)) {
        return false;
      }

      if (requiredType && candidate.type !== requiredType) {
        return false;
      }

      if (requiredFamily && getLearningFamily(candidate) !== requiredFamily) {
        return false;
      }

      return true;
    })
    .map((candidate) => {
      let score = 0;
      const adaptiveDifficultyBand = getAdaptiveDifficultyBand(candidate);
      const sessionDifficultyBias = getSessionDifficultyBias(candidate);
      const difficultyTypeOrder =
        SESSION_TYPE_ORDER_BY_ADAPTIVE_DIFFICULTY[adaptiveDifficultyBand];

      score += getTypeOrderScore(preferredOrder, candidate.type, 10);
      score += getTypeOrderScore(difficultyTypeOrder, candidate.type, 10);

      const desiredDifficulty =
        desiredDifficultyForIndex(index, total, sessionDifficultyBias) * 0.45 +
        SESSION_DIFFICULTY_TARGET_BY_BAND[adaptiveDifficultyBand] * 0.55;
      const candidateDifficulty = getNumericDifficulty(candidate);
      score -= Math.abs(candidateDifficulty - desiredDifficulty) * 2;

      const candidateModality = getExerciseModality(candidate);
      const preferredModality = getPreferredModality(candidate);
      const candidateFamily = getLearningFamily(candidate);
      const progressionIndex = progression.types.indexOf(candidate.type);

      if (candidate.type === desiredType) {
        score += 12;
      }

      if (progressionIndex >= 0) {
        score += Math.max(0, 10 - Math.abs(progressionIndex - desiredProgressionIndex) * 3);
      }

      if (candidateModality === preferredModality) {
        score += 8;
      } else if (
        preferredModality &&
        ((preferredModality === "mixed" && candidateModality !== "audio") ||
          (preferredModality === "context" && candidateModality === "mixed") ||
          (preferredModality === "text" && candidateModality === "mixed"))
      ) {
        score += 4;
      }

      if (requiredFamily && candidateFamily === requiredFamily) {
        score += 10;
      }

      const sameWordPriorTypes = new Set(
        chosen
          .filter((item) => readTargetWordId(item) === readTargetWordId(candidate))
          .map((item) => item.type)
      );
      const sameWordPriorFamilies = new Set(
        chosen
          .filter((item) => readTargetWordId(item) === readTargetWordId(candidate))
          .map(getLearningFamily)
      );

      if (sameWordPriorTypes.has(candidate.type)) {
        score -= candidate.type === "spelling_from_audio" ? 6 : 14;
      }

      if (sameWordPriorFamilies.has(candidateFamily)) {
        score -= candidateFamily === "audio_form" ? 3 : 8;
      }

      const recentChosen = chosen.slice(-4);
      const recentTypeCount = recentChosen.filter((item) => item.type === candidate.type).length;
      if (recentTypeCount > 0) {
        score -= recentTypeCount * (mode === "learn_new_words" ? 5 : 3);
      }

      const recentFamilyCount = recentChosen.filter(
        (item) => getLearningFamily(item) === candidateFamily
      ).length;
      if (recentFamilyCount >= 2) {
        score -= (recentFamilyCount - 1) * (mode === "learn_new_words" ? 4 : 2);
      }

      if (adaptiveDifficultyBand === "easy" && candidate.type === "meaning_match") {
        score += 4;
      }

      if (adaptiveDifficultyBand === "easy" && candidate.type === "pair_match") {
        score += 5;
      }

      if (
        adaptiveDifficultyBand === "hard" &&
        (
          candidate.type === "context_meaning" ||
          candidate.type === "fill_blank" ||
          candidate.type === "collocation" ||
          candidate.type === "sentence_builder"
        )
      ) {
        score += 4;
      }

      if (
        (candidate.type === "listen_match" || candidate.type === "spelling_from_audio") &&
        getExerciseAudioStatus(candidate) === "ready"
      ) {
        score += candidate.type === "spelling_from_audio"
          ? mode === "learn_new_words"
            ? 2
            : 4
          : mode === "learn_new_words"
            ? 4
            : mode === "mixed_practice"
              ? 5
              : 3;
      }

      if (candidate.type === "listen_match") {
        const chosenListenVariants = new Set(
          chosen
            .map((item) => getListenMatchVariant(item))
            .filter(
              (
                variant
              ): variant is NonNullable<ReturnType<typeof getListenMatchVariant>> =>
                Boolean(variant)
            )
        );
        const candidateVariant = getListenMatchVariant(candidate);

        if (candidateVariant === "translation" && !chosenListenVariants.has("translation")) {
          score += 8;
        } else if (
          candidateVariant === "english" &&
          chosenListenVariants.has("translation") &&
          !chosenListenVariants.has("english")
        ) {
          score += 10;
        } else if (
          candidateVariant === "english" &&
          !chosenListenVariants.has("english")
        ) {
          score += 6;
        } else if (candidateVariant === "meaning") {
          score -= 4;
        }
      }

      if (last?.type === candidate.type) score -= 8;
      if (last?.type === candidate.type && secondLast?.type === candidate.type) score -= 40;

      const lastModality = last ? getExerciseModality(last) : null;
      const secondLastModality = secondLast ? getExerciseModality(secondLast) : null;

      if (lastModality === candidateModality && candidateModality !== "mixed") {
        score -= 4;
      }

      if (
        lastModality === candidateModality &&
        secondLastModality === candidateModality &&
        candidateModality !== "mixed"
      ) {
        score -= 14;
      }

      score += deterministicWeight(seed, candidate.id);

      return {
        candidate,
        score,
        rule: progression.rule,
        triggeredBy:
          candidate.type === desiredType
            ? "modality_progression"
            : difficultyTypeOrder[0] === candidate.type
              ? "adaptive_difficulty"
              : progression.rule,
      };
    })
    .sort((left, right) => right.score - left.score);

  return scoredChoices[0] ?? null;
}

function scoreWordEntry(params: {
  entry: WordExerciseEntry;
  chosen: SupportedVocabExercise[];
  mode: VocabSessionMode;
  index: number;
  total: number;
  seed: string;
  requiredType?: SupportedVocabExerciseType;
  requiredFamily?: VocabularyLearningFamily;
  excludedExerciseIds?: Set<string>;
  allowGroupedSupport?: boolean;
}) {
  const { mode, chosen, total, index } = params;
  const bestChoice = chooseExerciseForWordEntry(params);
  if (!bestChoice) {
    return null;
  }

  const candidate = bestChoice.candidate;
  let score = bestChoice.score;
  const sessionDifficultyBias = getSessionDifficultyBias(candidate);

  const candidateBucket = getQueueBucket(candidate);
  const bucketPriorityOrder = SESSION_BUCKET_PRIORITY_ORDER_BY_MODE[mode];
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

  if (
    mode !== "learn_new_words" &&
    (
      candidate.type === "context_meaning" ||
      candidate.type === "fill_blank" ||
      candidate.type === "collocation" ||
      candidate.type === "pair_match" ||
      candidate.type === "sentence_builder"
    ) &&
    index >= 2
  ) {
    score += 3;
  }

  if (
    mode === "learn_new_words" &&
    index === total - 1 &&
    (
      candidate.type === "context_meaning" ||
      candidate.type === "fill_blank" ||
      candidate.type === "collocation" ||
      candidate.type === "pair_match" ||
      candidate.type === "sentence_builder"
    )
  ) {
    score += 4;
  }

  if (sessionDifficultyBias === "supportive" && candidateBucket !== "scheduled") {
    score += 2;
  }

  if (sessionDifficultyBias === "stretch" && candidateBucket === "scheduled") {
    score += 2;
  }

  score += (candidate.reviewMeta?.queuePriorityScore ?? 0) * 4;
  score += (candidate.reviewMeta?.selectionScore ?? 0) * 0.6;

  return {
    ...bestChoice,
    score,
  };
}

function incrementTouchCounts(
  exercise: SupportedVocabExercise,
  touchCounts: Map<string, number>
) {
  const coveredWordIds = getCoveredWordIds(exercise);
  let targetTouchNumber = 0;
  const targetWordId = readTargetWordId(exercise);

  for (const wordId of coveredWordIds) {
    const nextCount = (touchCounts.get(wordId) ?? 0) + 1;
    touchCounts.set(wordId, nextCount);

    if (wordId === targetWordId) {
      targetTouchNumber = nextCount;
    }
  }

  return {
    coveredWordIds,
    targetTouchNumber:
      targetTouchNumber || (targetWordId ? touchCounts.get(targetWordId) ?? 0 : 0),
  };
}

function pushChosenExercise(params: {
  next: NonNullable<ReturnType<typeof scoreWordEntry>>;
  chosen: SupportedVocabExercise[];
  remaining: WordExerciseEntry[];
  sequenceDebug: VocabExerciseSession["metadata"]["sequence_debug"];
  phase: VocabularySessionPhase;
  touchCounts: Map<string, number>;
  sessionRole: SessionSequenceRole;
  removeFromRemaining?: boolean;
}) {
  const {
    next,
    chosen,
    remaining,
    sequenceDebug,
    phase,
    touchCounts,
    sessionRole,
    removeFromRemaining = false,
  } = params;
  const touchSummary = incrementTouchCounts(next.candidate, touchCounts);

  chosen.push(next.candidate);
  sequenceDebug.push({
    index: chosen.length,
    exercise_id: next.candidate.id,
    target_word_id: readTargetWordId(next.candidate),
    target_word: getExerciseTargetWord(next.candidate),
    exercise_type: next.candidate.type,
    queue_bucket: getQueueBucket(next.candidate),
    continuation_source_bucket:
      next.candidate.reviewMeta?.continuationSourceBucket ?? null,
    session_phase: next.candidate.reviewMeta?.sessionPhase ?? phase,
    lifecycle_state: getLifecycleState(next.candidate),
    preferred_modality: getPreferredModality(next.candidate),
    selection_rule: getSelectionRule(next.candidate),
    selection_reason: getSelectionReason(next.candidate),
    source_lesson_id: next.candidate.reviewMeta?.sourceLessonId ?? null,
    source_lesson_title: next.candidate.reviewMeta?.sourceLessonTitle ?? null,
    source_passage_title: next.candidate.reviewMeta?.sourcePassageTitle ?? null,
    source_context_snippet:
      next.candidate.reviewMeta?.sourceContextSnippet ?? null,
    source_type: next.candidate.reviewMeta?.sourceType ?? null,
    adaptive_difficulty_band:
      next.candidate.reviewMeta?.adaptiveDifficultyBand ?? null,
    adaptive_difficulty_reason: getAdaptiveDifficultyReason(next.candidate),
    session_difficulty_bias: next.candidate.reviewMeta?.sessionDifficultyBias ?? null,
    session_role: sessionRole,
    learning_family: getLearningFamily(next.candidate),
    touch_number: touchSummary.targetTouchNumber,
    grouped_support_word_ids:
      sessionRole === "grouped_support" ? touchSummary.coveredWordIds : [],
    triggered_by: next.triggeredBy,
  });

  if (!removeFromRemaining) {
    return;
  }

  const nextWordId = readTargetWordId(next.candidate) || next.candidate.id;
  const nextIndex = remaining.findIndex((item) => item.wordId === nextWordId);

  if (nextIndex >= 0) {
    remaining.splice(nextIndex, 1);
  }
}

function countByRule(
  items: Array<{
    selection_rule: string | null;
    triggered_by: string;
  }>
) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = item.triggered_by || item.selection_rule || "unspecified";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function countByContinuationSource(
  items: Array<{
    continuation_source_bucket: VocabularyContinuationSourceBucket | null;
  }>
) {
  return items.reduce<Partial<Record<VocabularyContinuationSourceBucket, number>>>((acc, item) => {
    if (!item.continuation_source_bucket) {
      return acc;
    }

    acc[item.continuation_source_bucket] = (acc[item.continuation_source_bucket] ?? 0) + 1;
    return acc;
  }, {});
}

function countChosenType(
  chosen: SupportedVocabExercise[],
  type: SupportedVocabExerciseType
) {
  return chosen.filter((exercise) => exercise.type === type).length;
}

function withSessionCaps(params: {
  entry: WordExerciseEntry;
  chosen: SupportedVocabExercise[];
  maxSpellingTouches: number;
  requiredType?: SupportedVocabExerciseType;
}) {
  const spellingCount = countChosenType(params.chosen, "spelling_from_audio");
  const meaningCount = countChosenType(params.chosen, "meaning_match");
  const translationCount = countChosenType(params.chosen, "translation_match");
  return {
    ...params.entry,
    exercises: params.entry.exercises.filter((exercise) => {
      if (params.requiredType && exercise.type !== params.requiredType) {
        return true;
      }

      if (
        exercise.type === "spelling_from_audio" &&
        spellingCount >= params.maxSpellingTouches
      ) {
        return false;
      }

      if (exercise.type === "meaning_match" && meaningCount >= 1) {
        return false;
      }

      if (exercise.type === "translation_match" && translationCount >= 1) {
        return false;
      }

      return true;
    }),
  };
}

function scoreEntryForSelection(params: {
  entry: WordExerciseEntry;
  chosen: SupportedVocabExercise[];
  mode: VocabSessionMode;
  index: number;
  total: number;
  seed: string;
  requiredType?: SupportedVocabExerciseType;
  requiredFamily?: VocabularyLearningFamily;
  excludedExerciseIds: Set<string>;
  maxSpellingTouches: number;
  allowGroupedSupport?: boolean;
}) {
  const cappedEntry = withSessionCaps({
    entry: params.entry,
    chosen: params.chosen,
    maxSpellingTouches: params.maxSpellingTouches,
    requiredType: params.requiredType,
  });

  if (cappedEntry.exercises.length === 0) {
    return null;
  }

  const next = scoreWordEntry({
    entry: cappedEntry,
    chosen: params.chosen,
    mode: params.mode,
    index: params.index,
    total: params.total,
    seed: params.seed,
    requiredType: params.requiredType,
    requiredFamily: params.requiredFamily,
    excludedExerciseIds: params.excludedExerciseIds,
    allowGroupedSupport: params.allowGroupedSupport,
  });

  return next ? { entry: params.entry, next } : null;
}

function chooseBestScoredEntry(params: {
  entries: WordExerciseEntry[];
  chosen: SupportedVocabExercise[];
  mode: VocabSessionMode;
  index: number;
  total: number;
  seed: string;
  familyOrder: VocabularyLearningFamily[];
  excludedExerciseIds: Set<string>;
  maxSpellingTouches: number;
  requiredType?: SupportedVocabExerciseType | null;
  allowGroupedSupportFallback?: boolean;
}) {
  if (params.requiredType) {
    const scored = params.entries
      .map((entry) =>
        scoreEntryForSelection({
          ...params,
          entry,
          requiredType: params.requiredType ?? undefined,
          allowGroupedSupport: params.requiredType === "pair_match",
        })
      )
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => right.next.score - left.next.score);

    if (scored[0]) {
      return scored[0];
    }
  }

  for (const family of params.familyOrder) {
    const scored = params.entries
      .map((entry) =>
        scoreEntryForSelection({
          ...params,
          entry,
          requiredFamily: family,
          allowGroupedSupport: family === "grouped_support",
        })
      )
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => right.next.score - left.next.score);

    if (scored[0]) {
      return scored[0];
    }
  }

  const fallback = params.entries
    .map((entry) =>
      scoreEntryForSelection({
        ...params,
        entry,
        allowGroupedSupport: Boolean(params.allowGroupedSupportFallback),
      })
    )
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => right.next.score - left.next.score);

  return fallback[0] ?? null;
}

function getAnchorEligibleEntries(groupedPool: WordExerciseEntry[]) {
  const eligible = groupedPool.filter((entry) =>
    entry.exercises.some(canUseAsAnchorTouch)
  );

  return eligible.length > 0 ? eligible : groupedPool;
}

function getWordChosenExercises(
  chosen: SupportedVocabExercise[],
  wordId: string
) {
  return chosen.filter((exercise) => readTargetWordId(exercise) === wordId);
}

function getReinforcementFamilyOrder(params: {
  entry: WordExerciseEntry;
  chosen: SupportedVocabExercise[];
  baseOrder: VocabularyLearningFamily[];
}) {
  const usedFamilies = new Set<VocabularyLearningFamily>(
    getWordChosenExercises(params.chosen, params.entry.wordId)
      .map(getLearningFamily)
      .filter((family) => family !== "grouped_support")
  );
  const unusedFamilies = params.baseOrder.filter((family) => !usedFamilies.has(family));
  return [...unusedFamilies, ...params.baseOrder.filter((family) => usedFamilies.has(family))];
}

function scoreAnchorRisk(entry: WordExerciseEntry, seed: string) {
  const reference = entry.exercises[0];
  let score = 0;
  const bucket = getQueueBucket(reference);
  const lifecycle = getLifecycleState(reference);

  if (bucket === "recently_failed") score += 30;
  if (bucket === "weak_again") score += 26;
  if (bucket === "overdue") score += 18;
  if (bucket === "reinforcement") score += 10;
  if (lifecycle === "weak_again") score += 24;
  if (lifecycle === "new") score += 12;
  if (lifecycle === "learning") score += 10;
  if (lifecycle === "review") score += 6;

  score += (reference.reviewMeta?.consecutiveIncorrect ?? 0) * 6;
  score += Math.max(0, 1 - Number(reference.reviewMeta?.masteryScore ?? 0)) * 8;
  score += (reference.reviewMeta?.queuePriorityScore ?? 0) * 8;
  score += (reference.reviewMeta?.selectionScore ?? 0) * 0.5;
  score += deterministicWeight(seed, entry.wordId);

  return score;
}

function rankAnchorEntriesForRisk(entries: WordExerciseEntry[], seed: string) {
  return [...entries].sort(
    (left, right) => scoreAnchorRisk(right, seed) - scoreAnchorRisk(left, seed)
  );
}

function chooseGroupedSupportExercise(params: {
  exercises: SupportedVocabExercise[];
  chosen: SupportedVocabExercise[];
  excludedExerciseIds: Set<string>;
  anchorWordIds: Set<string>;
  touchCounts: Map<string, number>;
  seed: string;
}) {
  const scored = params.exercises
    .filter((exercise) => isGroupedSupportExercise(exercise))
    .filter((exercise) => !params.excludedExerciseIds.has(exercise.id))
    .map((exercise) => {
      const coveredWordIds = getCoveredWordIds(exercise);
      const anchorCoverage = coveredWordIds.filter((wordId) =>
        params.anchorWordIds.has(wordId)
      ).length;
      const underTouchedAnchorCoverage = coveredWordIds.filter(
        (wordId) =>
          params.anchorWordIds.has(wordId) &&
          (params.touchCounts.get(wordId) ?? 0) < 2
      ).length;
      const supportCoverage = coveredWordIds.filter(
        (wordId) => !params.anchorWordIds.has(wordId)
      ).length;
      let score =
        anchorCoverage * 8 +
        underTouchedAnchorCoverage * 5 +
        supportCoverage * 2 +
        coveredWordIds.length;

      const last = params.chosen[params.chosen.length - 1];
      if (last?.type === exercise.type) {
        score -= 8;
      }

      if (exercise.type === "listen_match" && getExerciseAudioStatus(exercise) === "ready") {
        score += 4;
      }

      score += deterministicWeight(params.seed, exercise.id);

      return {
        candidate: exercise,
        score,
        rule: "learning_reinforcement" as const,
        triggeredBy: "grouped_support",
      };
    })
    .sort((left, right) => right.score - left.score);

  return scored[0] ?? null;
}

function summarizeTouchCounts(params: {
  anchorWordIds: Set<string>;
  touchCounts: Map<string, number>;
}) {
  let wordsSeenOnce = 0;
  let wordsSeenTwice = 0;
  let wordsSeenThreePlus = 0;

  for (const wordId of params.anchorWordIds) {
    const count = params.touchCounts.get(wordId) ?? 0;
    if (count === 1) {
      wordsSeenOnce += 1;
    } else if (count === 2) {
      wordsSeenTwice += 1;
    } else if (count >= 3) {
      wordsSeenThreePlus += 1;
    }
  }

  return {
    wordsSeenOnce,
    wordsSeenTwice,
    wordsSeenThreePlus,
  };
}

function countSupportWords(params: {
  chosen: SupportedVocabExercise[];
  anchorWordIds: Set<string>;
}) {
  const supportWordIds = new Set<string>();

  for (const exercise of params.chosen) {
    if (!isGroupedSupportExercise(exercise)) {
      continue;
    }

    for (const wordId of getCoveredWordIds(exercise)) {
      if (!params.anchorWordIds.has(wordId)) {
        supportWordIds.add(wordId);
      }
    }
  }

  return supportWordIds.size;
}

export function buildVocabExerciseSession({
  exercises,
  mode,
  phase = "priority_review",
  continuationAvailable = false,
  targetSize,
  seed = "default-seed",
}: BuildSessionParams): VocabExerciseSession {
  const uniquePool = Array.from(new Map(exercises.map((item) => [item.id, item])).values());
  const groupedPool = groupExercisesByWord(uniquePool);
  const anchorEligibleEntries = getAnchorEligibleEntries(groupedPool);
  const anchorWordTarget = Math.min(
    targetSize ?? defaultTargetSize(mode, anchorEligibleEntries.length),
    anchorEligibleEntries.length
  );
  const touchPolicy = resolveSessionTouchPolicy(mode, anchorWordTarget);
  const requestedSize =
    touchPolicy.anchorWordTarget +
    touchPolicy.reinforcementBudget +
    touchPolicy.groupedSupportBudget;
  const rotationRecipe = resolveSessionRotationRecipe(seed);
  const chosen: SupportedVocabExercise[] = [];
  const sequenceDebug: VocabExerciseSession["metadata"]["sequence_debug"] = [];
  const touchCounts = new Map<string, number>();
  const excludedExerciseIds = new Set<string>();
  const anchorEntries: WordExerciseEntry[] = [];
  const anchorWordIds = new Set<string>();
  const remainingAnchorEntries = [...anchorEligibleEntries];

  for (let index = 0; index < touchPolicy.anchorWordTarget; index += 1) {
    if (remainingAnchorEntries.length === 0) {
      break;
    }

    const selected = chooseBestScoredEntry({
      entries: remainingAnchorEntries,
      chosen,
      mode,
      index: chosen.length,
      total: requestedSize,
      seed: `${seed}:anchor-primary:${index}`,
      requiredType: getRequiredTypeSlot(rotationRecipe.anchorTypeSlots, index),
      familyOrder: touchPolicy.primaryFamilyOrder,
      excludedExerciseIds,
      maxSpellingTouches: touchPolicy.maxSpellingTouches,
      allowGroupedSupportFallback: chosen.length === 0,
    });

    if (!selected) {
      break;
    }

    excludedExerciseIds.add(selected.next.candidate.id);
    anchorEntries.push(selected.entry);
    anchorWordIds.add(selected.entry.wordId);
    pushChosenExercise({
      next: selected.next,
      chosen,
      remaining: remainingAnchorEntries,
      sequenceDebug,
      phase,
      touchCounts,
      sessionRole: canUseAsAnchorTouch(selected.next.candidate)
        ? "anchor_primary"
        : "fallback",
      removeFromRemaining: true,
    });
  }

  let reinforcementBudgetRemaining = touchPolicy.reinforcementBudget;
  const riskRankedAnchors = rankAnchorEntriesForRisk(
    anchorEntries,
    `${seed}:risk-rank`
  );
  const secondTouchAnchors =
    mode === "learn_new_words"
      ? anchorEntries
      : riskRankedAnchors.slice(0, reinforcementBudgetRemaining);

  for (const entry of secondTouchAnchors) {
    if (reinforcementBudgetRemaining <= 0) {
      break;
    }

    const selected = chooseBestScoredEntry({
      entries: [entry],
      chosen,
      mode,
      index: chosen.length,
      total: requestedSize,
      seed: `${seed}:anchor-reinforcement:${entry.wordId}`,
      requiredType: getRequiredTypeSlot(
        rotationRecipe.reinforcementTypeSlots,
        touchPolicy.reinforcementBudget - reinforcementBudgetRemaining
      ),
      familyOrder: getReinforcementFamilyOrder({
        entry,
        chosen,
        baseOrder: touchPolicy.reinforcementFamilyOrder,
      }),
      excludedExerciseIds,
      maxSpellingTouches: touchPolicy.maxSpellingTouches,
    });

    if (!selected) {
      continue;
    }

    excludedExerciseIds.add(selected.next.candidate.id);
    reinforcementBudgetRemaining -= 1;
    pushChosenExercise({
      next: selected.next,
      chosen,
      remaining: remainingAnchorEntries,
      sequenceDebug,
      phase,
      touchCounts,
      sessionRole: "anchor_reinforcement",
    });
  }

  if (mode === "learn_new_words" && reinforcementBudgetRemaining > 0) {
    for (const entry of riskRankedAnchors) {
      if (reinforcementBudgetRemaining <= 0) {
        break;
      }

      if ((touchCounts.get(entry.wordId) ?? 0) >= 3) {
        continue;
      }

      const selected = chooseBestScoredEntry({
        entries: [entry],
        chosen,
        mode,
        index: chosen.length,
        total: requestedSize,
        seed: `${seed}:anchor-risk:${entry.wordId}`,
        requiredType: getRequiredTypeSlot(
          rotationRecipe.reinforcementTypeSlots,
          touchPolicy.reinforcementBudget - reinforcementBudgetRemaining
        ),
        familyOrder: getReinforcementFamilyOrder({
          entry,
          chosen,
          baseOrder: touchPolicy.reinforcementFamilyOrder,
        }),
        excludedExerciseIds,
        maxSpellingTouches: touchPolicy.maxSpellingTouches,
      });

      if (!selected) {
        continue;
      }

      excludedExerciseIds.add(selected.next.candidate.id);
      reinforcementBudgetRemaining -= 1;
      pushChosenExercise({
        next: selected.next,
        chosen,
        remaining: remainingAnchorEntries,
        sequenceDebug,
        phase,
        touchCounts,
        sessionRole: "anchor_risk_reinforcement",
      });
    }
  }

  for (let index = 0; index < touchPolicy.groupedSupportBudget; index += 1) {
    const next = chooseGroupedSupportExercise({
      exercises: uniquePool,
      chosen,
      excludedExerciseIds,
      anchorWordIds,
      touchCounts,
      seed: `${seed}:grouped-support:${index}`,
    });

    if (!next) {
      break;
    }

    excludedExerciseIds.add(next.candidate.id);
    pushChosenExercise({
      next,
      chosen,
      remaining: remainingAnchorEntries,
      sequenceDebug,
      phase,
      touchCounts,
      sessionRole: "grouped_support",
    });
  }

  if (chosen.length === 0 && groupedPool.length > 0) {
    const fallback = chooseBestScoredEntry({
      entries: groupedPool,
      chosen,
      mode,
      index: 0,
      total: Math.max(1, requestedSize),
      seed: `${seed}:fallback`,
      familyOrder: ["recognition", "audio_form", "context_semantic", "grouped_support"],
      excludedExerciseIds,
      maxSpellingTouches: touchPolicy.maxSpellingTouches,
      allowGroupedSupportFallback: true,
    });

    if (fallback) {
      anchorEntries.push(fallback.entry);
      anchorWordIds.add(fallback.entry.wordId);
      pushChosenExercise({
        next: fallback.next,
        chosen,
        remaining: remainingAnchorEntries,
        sequenceDebug,
        phase,
        touchCounts,
        sessionRole: "fallback",
      });
    }
  }

  const countsByType = countByType(chosen);
  const countsByBucket = countByBucket(chosen);
  const countsByDifficulty = countByDifficulty(chosen);
  const targetWordIds = chosen.map((item) => readTargetWordId(item));
  const uniqueTargetWords = new Set(targetWordIds).size;
  const touchSummary = summarizeTouchCounts({ anchorWordIds, touchCounts });
  const totalInteractions = Array.from(touchCounts.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  return {
    session_id: makeSessionId(
      mode,
      `${seed}:${touchPolicy.anchorWordTarget}:${requestedSize}:${uniquePool.length}`
    ),
    mode,
    exercise_ids: chosen.map((item) => item.id),
    ordered_exercises: chosen,
    target_word_ids: targetWordIds,
    metadata: {
      requested_size: requestedSize,
      actual_size: chosen.length,
      counts_by_type: countsByType,
      counts_by_bucket: countsByBucket,
      counts_by_difficulty: countsByDifficulty,
      counts_by_rule: countByRule(sequenceDebug),
      unique_target_words: uniqueTargetWords,
      repeated_target_words: chosen.length - uniqueTargetWords,
      anchor_word_target: touchPolicy.anchorWordTarget,
      anchor_word_count: anchorWordIds.size,
      support_word_count: countSupportWords({ chosen, anchorWordIds }),
      words_seen_once: touchSummary.wordsSeenOnce,
      words_seen_twice: touchSummary.wordsSeenTwice,
      words_seen_three_plus: touchSummary.wordsSeenThreePlus,
      total_interactions: totalInteractions,
      reinforcement_budget: touchPolicy.reinforcementBudget,
      grouped_support_budget: touchPolicy.groupedSupportBudget,
      rotation_recipe: rotationRecipe.id,
      forced_type_slots: rotationRecipe.anchorTypeSlots,
      dominant_bucket: dominantBucket(chosen),
      session_phase: phase,
      extended_practice_mode: phase === "endless_continuation",
      continuation_available: continuationAvailable,
      checkpoint_index: phase === "priority_review" ? 1 : 2,
      continuation_source_counts: countByContinuationSource(sequenceDebug),
      sequence_debug: sequenceDebug,
    },
  };
}
