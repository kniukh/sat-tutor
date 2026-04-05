import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getStudentVocabularyAnalytics,
  type StudentVocabularyAnalytics,
} from "@/services/analytics/vocabulary-analytics.service";
import {
  groupExercisesByWord,
  selectAdaptiveSessionExercises,
  type AdaptiveSessionSelectionSummary,
  type AdaptiveWordCandidate,
} from "@/services/vocabulary/adaptive-session-selection.service";
import {
  adaptCollocationDrillsToExercises,
  adaptContextMeaningDrillsToExercises,
  adaptErrorDetectionDrillsToExercises,
  adaptListenMatchDrillsToExercises,
  adaptMeaningDrillsToExercises,
  adaptPairMatchDrillsToExercises,
  adaptSpellingFromAudioDrillsToExercises,
  adaptSynonymDrillsToExercises,
} from "@/services/vocabulary/exercise-adapters";
import {
  classifyReviewQueueCandidate,
  generateReviewQueueForStudent,
  getNextReviewQueueCandidates,
  listActiveReviewQueueCandidates,
  type ReviewQueueCandidate,
  type ReviewQueuePriorityBucket,
} from "@/services/vocabulary/review-queue.service";
import {
  buildVocabExerciseSession,
  type VocabExerciseSession,
  type VocabSessionMode,
} from "@/services/vocabulary/session-builder";
import {
  hasReadyVocabularyDrillAnswerSets,
  parseVocabularyDrillAnswerSets,
} from "@/services/vocabulary/drill-answer-sets.service";
import { getStudentGamificationSnapshot } from "@/services/gamification/gamification.service";
import {
  getExerciseTargetWordId,
  type VocabExerciseSourceType,
  type VocabularySessionPhase,
  type SupportedVocabExercise,
} from "@/types/vocab-exercises";
import type { VocabularyDrillAnswerSetMap } from "@/types/vocabulary-answer-sets";
import type { ExerciseAttemptRow } from "@/types/vocab-tracking";

type VocabularyPageStudent = {
  id: string;
  fullName: string;
  accessCode: string;
};

type DrillItem = {
  wordProgressId: string;
  vocabularyItemId: string;
  itemText: string;
  itemType: "word" | "phrase";
  correctAnswer: string;
  distractors: string[];
  answerSets: VocabularyDrillAnswerSetMap;
  contextSentence: string;
  plainMeaning: string;
  translatedExplanation: string | null;
  translationLanguage: string | null;
  exampleText: string;
  audioUrl: string | null;
  audioStatus: "ready" | "pending" | "failed" | "missing" | null;
  sourceLessonId: string | null;
  sourceLessonTitle: string | null;
  sourcePassageTitle: string | null;
  sourceContextSnippet: string | null;
  sourceCapturedAt: string | null;
  sourceType: VocabExerciseSourceType | null;
};

type SourceCaptureMeta = {
  lessonId: string | null;
  passageId: string | null;
  passageTitle: string | null;
  contextSnippet: string | null;
  capturedAt: string | null;
};

type QueueBucketCounts = Record<ReviewQueuePriorityBucket, number>;

type AudioPreparationSummary = {
  readyCount: number;
  pendingCount: number;
  failedCount: number;
  missingCount: number;
  listenReadyWordCount: number;
  topPrepLesson: {
    lessonId: string;
    lessonName: string;
    prepItemCount: number;
  } | null;
};

export type VocabularyPageMode = Extract<
  VocabSessionMode,
  "learn_new_words" | "review_weak_words" | "mixed_practice"
>;

export type VocabularyDashboardData = {
  totals: {
    totalWordsLearned: number;
    masteredWords: number;
    wordsInReview: number;
    weakWords: number;
    practicedTodayWords: number;
    totalTrackedWords: number;
  };
  reviewIndicators: {
    dueNow: number;
    overdueRetentionChecks: number;
    weakReinforcement: number;
  };
  masteryDistribution: StudentVocabularyAnalytics["masteryDistribution"];
  streak: {
    current: number;
    longest: number;
  };
};

export type StudentVocabularyPageData = {
  student: VocabularyPageStudent;
  selectedMode: VocabularyPageMode;
  selectedPhase: VocabularySessionPhase;
  dashboard: VocabularyDashboardData;
  summary: {
    totalQueueItems: number;
    dueNowCount: number;
    readyDrillsCount: number;
    priorityReadyCount: number;
    continuationReadyCount: number;
    canContinueEndlessly: boolean;
    activePhase: VocabularySessionPhase | null;
    activePhaseLabel: string | null;
    readyPercent: number;
    newWordPoolCount: number;
    bucketCounts: QueueBucketCounts;
    topPriorityBucket: ReviewQueuePriorityBucket | null;
    topPriorityLabel: string | null;
    upcomingWords: string[];
    audioPreparation: AudioPreparationSummary;
    learnNewWords: {
      newestCapturedItems: string[];
      recentLessons: Array<{
        lessonId: string;
        lessonName: string;
        readyNewWordCount: number;
      }>;
    };
    lessonFocus: {
      lessonId: string;
      lessonName: string;
      matchedWordCount: number;
      matchedReadyCount: number;
      matchedNewWordCount: number;
      matchedContinuationCount: number;
    } | null;
  };
  adaptiveSelection: AdaptiveSessionSelectionSummary | null;
  drillCounts: {
    words: number;
    phrases: number;
    cloze: number;
  };
  session: VocabExerciseSession | null;
  preparationNeeded: boolean;
};

const EMPTY_BUCKET_COUNTS: QueueBucketCounts = {
  recently_failed: 0,
  weak_again: 0,
  overdue: 0,
  reinforcement: 0,
  scheduled: 0,
};

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

function getBucketLabel(bucket: ReviewQueuePriorityBucket | null) {
  switch (bucket) {
    case "recently_failed":
      return "Recently failed words";
    case "weak_again":
      return "Weak again words";
    case "overdue":
      return "Overdue review words";
    case "reinforcement":
      return "Learning reinforcement";
    case "scheduled":
      return "Scheduled review";
    default:
      return null;
  }
}

function pickTopPriorityBucket(bucketCounts: QueueBucketCounts) {
  const priorityOrder: ReviewQueuePriorityBucket[] = [
    "recently_failed",
    "weak_again",
    "overdue",
    "reinforcement",
    "scheduled",
  ];

  for (const bucket of priorityOrder) {
    if (bucketCounts[bucket] > 0) {
      return bucket;
    }
  }

  return null;
}

function getLifecycleCount(
  distribution: StudentVocabularyAnalytics["masteryDistribution"],
  lifecycleState: StudentVocabularyAnalytics["masteryDistribution"][number]["lifecycleState"]
) {
  return distribution.find((item) => item.lifecycleState === lifecycleState)?.count ?? 0;
}

export function normalizeVocabularyPageMode(mode: string | undefined): VocabularyPageMode {
  if (mode === "review_weak_words") return "review_weak_words";
  if (mode === "learn_new_words") return "learn_new_words";
  return "mixed_practice";
}

export function normalizeVocabularySessionPhase(
  phase: string | undefined
): VocabularySessionPhase | null {
  if (phase === "endless_continuation") {
    return "endless_continuation";
  }

  if (phase === "priority_review") {
    return "priority_review";
  }

  return null;
}

export function normalizeVocabularyLessonId(lessonId: string | undefined) {
  const normalized = lessonId?.trim();
  return normalized ? normalized : null;
}

function getSessionPhaseLabel(phase: VocabularySessionPhase | null) {
  if (phase === "priority_review") {
    return "Priority review";
  }

  if (phase === "endless_continuation") {
    return "Endless continuation";
  }

  return null;
}

function inferSourceType(lessonType: string | null | undefined): VocabExerciseSourceType {
  const normalized = lessonType?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return "other";
  }

  if (normalized.includes("reading")) {
    return "reading_lesson";
  }

  if (normalized.includes("generated") || normalized.includes("ai")) {
    return "generated_lesson";
  }

  return "other";
}

function toDrillItem(
  detail: any,
  wordProgressId: string,
  lessonMetaMap?: Map<string, { lessonName: string; lessonType: string | null }>,
  sourceCaptureMap?: Map<string, SourceCaptureMeta>
): DrillItem | null {
  if (
    !detail ||
    !detail.id ||
    !detail.item_text ||
    !detail.english_explanation ||
    !Array.isArray(detail.distractors) ||
    detail.distractors.length < 3 ||
    !hasReadyVocabularyDrillAnswerSets(detail.drill_answer_sets)
  ) {
    return null;
  }

  const itemType = (detail.item_type ?? "word") as "word" | "phrase";
  const correctAnswer =
    itemType === "phrase"
      ? detail.example_text || detail.english_explanation
      : detail.english_explanation;
  const sourceKey =
    detail.lesson_id && detail.item_text
      ? `${detail.lesson_id}:${String(detail.item_text).trim().toLowerCase()}`
      : null;
  const sourceCapture = sourceKey ? sourceCaptureMap?.get(sourceKey) ?? null : null;
  const lessonMeta = detail.lesson_id ? lessonMetaMap?.get(detail.lesson_id) ?? null : null;

  return {
    wordProgressId,
    vocabularyItemId: detail.id,
    itemText: detail.item_text,
    itemType,
    correctAnswer,
    distractors: detail.distractors,
    answerSets: parseVocabularyDrillAnswerSets(detail.drill_answer_sets),
    contextSentence: detail.context_sentence || "",
    plainMeaning: detail.english_explanation,
    translatedExplanation: detail.translated_explanation || null,
    translationLanguage: detail.translation_language || null,
    exampleText: detail.example_text || "",
    audioUrl: detail.audio_url || null,
    audioStatus: (detail.audio_status ?? null) as
      | "ready"
      | "pending"
      | "failed"
      | "missing"
      | null,
    sourceLessonId: sourceCapture?.lessonId ?? detail.lesson_id ?? null,
    sourceLessonTitle: lessonMeta?.lessonName ?? null,
    sourcePassageTitle: sourceCapture?.passageTitle ?? null,
    sourceContextSnippet:
      sourceCapture?.contextSnippet ??
      detail.context_sentence ??
      detail.example_text ??
      detail.item_text ??
      null,
    sourceCapturedAt: sourceCapture?.capturedAt ?? detail.created_at ?? null,
    sourceType: inferSourceType(lessonMeta?.lessonType),
  };
}

function attachQueueReviewMeta<TExercise extends SupportedVocabExercise>(
  exercises: TExercise[],
  queueCandidateMap: Map<string, ReviewQueueCandidate>,
  wordProgressMap: Map<string, any>
) {
  return exercises.map((exercise) => {
    const targetWordId = getExerciseTargetWordId(exercise);
    const candidate = queueCandidateMap.get(targetWordId);
    const wordProgress = wordProgressMap.get(targetWordId);

    if (!candidate) {
      return exercise;
    }

    return {
      ...exercise,
      reviewMeta: {
        ...(exercise.reviewMeta ?? {}),
        attemptCount: wordProgress?.total_attempts ?? exercise.reviewMeta?.attemptCount,
        dueAt: candidate.scheduled_for,
        lastReviewedAt: wordProgress?.last_seen_at ?? null,
        queueBucket: classifyReviewQueueCandidate(candidate, new Date()),
        queueReason: candidate.reason,
        queuePriorityScore: candidate.priority_score,
        lifecycleState: wordProgress?.lifecycle_state ?? null,
        masteryScore: wordProgress?.mastery_score ?? null,
        lastModality: wordProgress?.last_modality ?? null,
        recommendedModality: candidate.recommended_modality ?? null,
        consecutiveIncorrect: wordProgress?.consecutive_incorrect ?? 0,
        sourceOrigin:
          exercise.reviewMeta?.sourceLessonId
            ? "review_queue"
            : exercise.reviewMeta?.sourceOrigin,
        lessonFirstExposure: false,
      },
    };
  });
}

function attachNewWordReviewMeta<TExercise extends { reviewMeta?: Record<string, any> }>(
  exercises: TExercise[]
) {
  return exercises.map((exercise) => ({
    ...exercise,
    reviewMeta: {
      ...(exercise.reviewMeta ?? {}),
      queueBucket: "scheduled" as const,
      queueReason: "new_word_introduction",
      queuePriorityScore: 0.2,
      attemptCount: exercise.reviewMeta?.attemptCount ?? 0,
      lifecycleState: "new" as const,
      masteryScore: 0,
      lastModality: null,
      recommendedModality: "text" as const,
      consecutiveIncorrect: 0,
      lessonFirstExposure: Boolean(exercise.reviewMeta?.sourceLessonId),
      sourceOrigin:
        exercise.reviewMeta?.sourceLessonId ? "new_word_pool" : exercise.reviewMeta?.sourceOrigin,
    },
  }));
}

function inferContinuationQueueBucket(wordProgress: any): ReviewQueuePriorityBucket {
  if (wordProgress?.lifecycle_state === "weak_again") {
    return "weak_again";
  }

  if (
    wordProgress?.lifecycle_state === "learning" ||
    wordProgress?.lifecycle_state === "review"
  ) {
    return "reinforcement";
  }

  return "scheduled";
}

function inferContinuationQueueReason(wordProgress: any) {
  if (wordProgress?.lifecycle_state === "weak_again") {
    return "continuation_weak_recovery";
  }

  if (wordProgress?.lifecycle_state === "mastered") {
    return "continuation_retention_check";
  }

  if (
    wordProgress?.lifecycle_state === "learning" ||
    wordProgress?.lifecycle_state === "review" ||
    wordProgress?.lifecycle_state === "new"
  ) {
    return "continuation_learning_reinforcement";
  }

  return "continuation_mixed_practice";
}

function attachContinuationReviewMeta<TExercise extends SupportedVocabExercise>(
  exercises: TExercise[],
  wordProgressMap: Map<string, any>
) {
  return exercises.map((exercise) => {
    const targetWordId = getExerciseTargetWordId(exercise);
    const wordProgress = targetWordId ? wordProgressMap.get(targetWordId) : null;

    return {
      ...exercise,
      reviewMeta: {
        ...(exercise.reviewMeta ?? {}),
        attemptCount: wordProgress?.total_attempts ?? exercise.reviewMeta?.attemptCount ?? 0,
        dueAt: wordProgress?.next_review_at ?? exercise.reviewMeta?.dueAt ?? null,
        lastReviewedAt: wordProgress?.last_seen_at ?? exercise.reviewMeta?.lastReviewedAt ?? null,
        queueBucket: inferContinuationQueueBucket(wordProgress),
        queueReason: inferContinuationQueueReason(wordProgress),
        queuePriorityScore: exercise.reviewMeta?.queuePriorityScore ?? 0.15,
        lifecycleState: wordProgress?.lifecycle_state ?? exercise.reviewMeta?.lifecycleState ?? null,
        masteryScore: wordProgress?.mastery_score ?? exercise.reviewMeta?.masteryScore ?? null,
        lastModality: wordProgress?.last_modality ?? exercise.reviewMeta?.lastModality ?? null,
        recommendedModality:
          exercise.reviewMeta?.recommendedModality ??
          (wordProgress?.last_modality === "text" ? "context" : wordProgress?.last_modality) ??
          null,
        consecutiveIncorrect:
          wordProgress?.consecutive_incorrect ?? exercise.reviewMeta?.consecutiveIncorrect ?? 0,
        lessonFirstExposure:
          Boolean(exercise.reviewMeta?.sourceLessonId) &&
          (wordProgress?.lifecycle_state === "new" || wordProgress?.total_attempts <= 1),
        sourceOrigin:
          exercise.reviewMeta?.sourceLessonId ? "lesson_capture" : exercise.reviewMeta?.sourceOrigin,
      },
    };
  });
}

function buildExercisePoolFromDrillItems(drillItems: DrillItem[]) {
  const wordDrills = drillItems.filter((item) => item.itemType === "word");
  const phraseDrills = drillItems.filter((item) => item.itemType === "phrase");
  const contextMeaningDrills = drillItems.filter((item) => item.contextSentence);
  const synonymDrills = drillItems;
  const collocationDrills = drillItems.filter(
    (item) => Boolean(item.exampleText || item.contextSentence)
  );
  const pairMatchDrills = drillItems.filter(
    (item) => item.itemType === "word" || Boolean(item.exampleText || item.contextSentence)
  );
  const errorDetectionDrills = drillItems.filter(
    (item) => Boolean(item.exampleText || item.contextSentence)
  );
  const listenMatchDrills = drillItems.filter(
    (item) => Boolean(item.audioUrl) && item.audioStatus !== "failed" && item.audioStatus !== "missing"
  );
  const spellingFromAudioDrills = listenMatchDrills;

  return {
    wordDrills,
    phraseDrills,
    clozeDrills: contextMeaningDrills,
    contextMeaningDrills,
    synonymDrills,
    collocationDrills,
    pairMatchDrills,
    sentenceBuilderDrills: [],
    errorDetectionDrills,
    listenMatchDrills,
    spellingFromAudioDrills,
    exercises: [
      ...adaptMeaningDrillsToExercises(wordDrills),
      ...adaptMeaningDrillsToExercises(phraseDrills),
      ...adaptListenMatchDrillsToExercises(listenMatchDrills),
      ...adaptSpellingFromAudioDrillsToExercises(spellingFromAudioDrills),
      ...adaptContextMeaningDrillsToExercises(contextMeaningDrills),
      ...adaptSynonymDrillsToExercises(synonymDrills),
      ...adaptCollocationDrillsToExercises(collocationDrills),
      ...adaptPairMatchDrillsToExercises(pairMatchDrills),
      ...adaptErrorDetectionDrillsToExercises(errorDetectionDrills),
    ],
  };
}

function summarizeAudioPreparation(params: {
  details: any[];
  lessonNameMap: Map<string, string>;
}) {
  const summary: AudioPreparationSummary = {
    readyCount: 0,
    pendingCount: 0,
    failedCount: 0,
    missingCount: 0,
    listenReadyWordCount: 0,
    topPrepLesson: null,
  };
  const prepLessonMap = new Map<
    string,
    { lessonId: string; lessonName: string; prepItemCount: number }
  >();

  for (const detail of params.details) {
    if (!detail?.id || !detail.item_text) {
      continue;
    }

    const isReady = detail.audio_status === "ready" && Boolean(detail.audio_url);

    if (isReady) {
      summary.readyCount += 1;
      summary.listenReadyWordCount += 1;
      continue;
    }

    if (detail.audio_status === "pending") {
      summary.pendingCount += 1;
    } else if (detail.audio_status === "failed") {
      summary.failedCount += 1;
    } else {
      summary.missingCount += 1;
    }

    if (!detail.lesson_id) {
      continue;
    }

    const existing = prepLessonMap.get(detail.lesson_id);
    if (existing) {
      existing.prepItemCount += 1;
      continue;
    }

    prepLessonMap.set(detail.lesson_id, {
      lessonId: detail.lesson_id,
      lessonName: params.lessonNameMap.get(detail.lesson_id) ?? "Untitled lesson",
      prepItemCount: 1,
    });
  }

  summary.topPrepLesson =
    Array.from(prepLessonMap.values()).sort((a, b) => b.prepItemCount - a.prepItemCount)[0] ??
    null;

  return summary;
}

function groupRecentAttemptsByWord(recentAttempts: ExerciseAttemptRow[]) {
  const grouped = new Map<string, ExerciseAttemptRow[]>();

  for (const attempt of recentAttempts) {
    if (!attempt.target_word_id) {
      continue;
    }

    const existing = grouped.get(attempt.target_word_id) ?? [];
    if (existing.length < 5) {
      existing.push(attempt);
      grouped.set(attempt.target_word_id, existing);
    }
  }

  return grouped;
}

function buildAdaptiveWordCandidates(params: {
  exercises: SupportedVocabExercise[];
  recentAttemptsByWordId: Map<string, ExerciseAttemptRow[]>;
  wordProgressMap?: Map<string, any>;
  queueCandidateMap?: Map<string, ReviewQueueCandidate>;
  isNewWord: boolean;
}) {
  const groupedExercises = groupExercisesByWord(params.exercises);

  return Array.from(groupedExercises.entries()).map(([wordId, exercises]) => {
    const firstExercise = exercises[0];
    const wordProgress = params.wordProgressMap?.get(wordId);
    const queueCandidate = params.queueCandidateMap?.get(wordId);

    return {
      wordId,
      word: firstExercise.target_word ?? firstExercise.targetWord ?? "",
      exercises,
      lifecycleState: wordProgress?.lifecycle_state ?? queueCandidate?.lifecycle_state ?? null,
      masteryScore: wordProgress?.mastery_score ?? queueCandidate?.mastery_score ?? null,
      consecutiveCorrect: Number(wordProgress?.consecutive_correct ?? 0),
      consecutiveIncorrect: Number(wordProgress?.consecutive_incorrect ?? 0),
      currentDifficultyBand: wordProgress?.current_difficulty_band ?? null,
      nextReviewAt: wordProgress?.next_review_at ?? queueCandidate?.scheduled_for ?? null,
      lastSeenAt: wordProgress?.last_seen_at ?? null,
      lastModality: wordProgress?.last_modality ?? queueCandidate?.last_modality ?? null,
      queueBucket: firstExercise.reviewMeta?.queueBucket ?? null,
      queueReason: firstExercise.reviewMeta?.queueReason ?? null,
      queuePriorityScore: firstExercise.reviewMeta?.queuePriorityScore ?? null,
      recommendedModality: firstExercise.reviewMeta?.recommendedModality ?? null,
      recentAttempts: params.recentAttemptsByWordId.get(wordId) ?? [],
      isNewWord: params.isNewWord,
      sourceLessonId: firstExercise.reviewMeta?.sourceLessonId ?? null,
      sourceLessonTitle: firstExercise.reviewMeta?.sourceLessonTitle ?? null,
      sourcePassageTitle: firstExercise.reviewMeta?.sourcePassageTitle ?? null,
      sourceContextSnippet: firstExercise.reviewMeta?.sourceContextSnippet ?? null,
      sourceCapturedAt: firstExercise.reviewMeta?.sourceCapturedAt ?? null,
      sourceType: firstExercise.reviewMeta?.sourceType ?? null,
      lessonFirstExposure: Boolean(firstExercise.reviewMeta?.lessonFirstExposure),
    } satisfies AdaptiveWordCandidate;
  });
}

function attachAdaptiveSelectionMeta<TExercise extends SupportedVocabExercise>(params: {
  exercises: TExercise[];
  selectedWords: AdaptiveSessionSelectionSummary["selectedWords"];
}) {
  const selectedWordMap = new Map(params.selectedWords.map((item) => [item.wordId, item]));

  return params.exercises
    .filter((exercise) => selectedWordMap.has(getExerciseTargetWordId(exercise)))
    .map((exercise) => {
      const summary = selectedWordMap.get(getExerciseTargetWordId(exercise));
      if (!summary) {
        return exercise;
      }

      return {
        ...exercise,
        reviewMeta: {
          ...(exercise.reviewMeta ?? {}),
          sessionPhase: summary.sessionPhase,
          extendedPracticeMode: summary.sessionPhase === "endless_continuation",
          continuationSourceBucket: summary.continuationSourceBucket,
          selectionBucket: summary.bucket,
          selectionReason: summary.reason,
          preferredModality: summary.preferredModality,
          selectionScore: summary.score,
          selectionRule: summary.selectionRule,
          adaptiveDifficultyBand: summary.adaptiveDifficultyBand,
          adaptiveDifficultyReason: summary.adaptiveDifficultyReason,
          sessionDifficultyBias: summary.sessionDifficultyBias,
          recentAccuracy: summary.recentAccuracy,
          averageResponseTimeMs: summary.averageResponseTimeMs,
          strongestModality: summary.strongestModality,
          weakestModality: summary.weakestModality,
        },
      };
    });
}

export async function getStudentVocabularyPageData(
  accessCode: string,
  selectedMode: VocabularyPageMode = "mixed_practice",
  requestedPhase: VocabularySessionPhase | null = null,
  preferredLessonId: string | null = null
) {
  const supabase = await createServerSupabaseClient();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, full_name, access_code")
    .eq("access_code", accessCode)
    .eq("is_active", true)
    .single();

  if (studentError || !student) {
    throw new Error("Student not found");
  }

  const studentData: VocabularyPageStudent = {
    id: student.id,
    fullName: student.full_name,
    accessCode: student.access_code,
  };

  await generateReviewQueueForStudent({
    studentId: studentData.id,
    limit: 150,
  });

  const [
    activeQueueCandidates,
    nextQueueCandidates,
    allVocabDetails,
    attemptedWordIds,
    vocabularyAnalytics,
    gamificationResult,
  ] = await Promise.all([
      listActiveReviewQueueCandidates({
        studentId: studentData.id,
        limit: 150,
      }),
      getNextReviewQueueCandidates({
        studentId: studentData.id,
        limit: 8,
        dueOnly: false,
      }),
      supabase
        .from("vocabulary_item_details")
        .select("*")
        .eq("student_id", studentData.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("exercise_attempts")
        .select("target_word_id")
        .eq("student_id", studentData.id)
        .not("target_word_id", "is", null),
      getStudentVocabularyAnalytics(studentData.id),
      getStudentGamificationSnapshot(studentData.id),
    ]);

  if (allVocabDetails.error) {
    throw allVocabDetails.error;
  }

  if (attemptedWordIds.error) {
    throw attemptedWordIds.error;
  }

  let vocabularyDetailRows = (allVocabDetails.data ?? []) as any[];
  const hasAnyReadyVocabularyItems = vocabularyDetailRows.some((detail: any) => {
    if (!detail?.id || detail.is_understood === true || !detail.english_explanation) {
      return false;
    }

    if (!Array.isArray(detail.distractors) || detail.distractors.length < 3) {
      return false;
    }

    return hasReadyVocabularyDrillAnswerSets(detail.drill_answer_sets);
  });

  const now = new Date();
  const bucketCounts = activeQueueCandidates.reduce<QueueBucketCounts>((acc, candidate) => {
    const bucket = classifyReviewQueueCandidate(candidate, now);
    acc[bucket] += 1;
    return acc;
  }, { ...EMPTY_BUCKET_COUNTS });

  const queueWordIds = Array.from(
    new Set(activeQueueCandidates.map((candidate) => candidate.word_id).filter(Boolean))
  );
  const allReadyVocabularyDetails = vocabularyDetailRows.filter((detail: any) => {
    if (!detail?.id) return false;
    if (detail.is_understood === true) return false;
    if (!detail.english_explanation) return false;
    if (!Array.isArray(detail.distractors) || detail.distractors.length < 3) return false;
    if (!hasReadyVocabularyDrillAnswerSets(detail.drill_answer_sets)) return false;
    return true;
  });
  const allReadyWordIds = Array.from(
    new Set(allReadyVocabularyDetails.map((detail: any) => detail.id).filter(Boolean))
  );

  const { data: wordProgressRows, error: wordProgressError } = await supabase
    .from("word_progress")
    .select("*")
    .eq("student_id", studentData.id)
    .in("word_id", allReadyWordIds.length > 0 ? allReadyWordIds : [EMPTY_UUID]);

  if (wordProgressError) {
    throw wordProgressError;
  }

  const { data: queueVocabDetails, error: queueVocabDetailsError } = await supabase
    .from("vocabulary_item_details")
    .select("*")
    .eq("student_id", studentData.id)
    .in("id", queueWordIds.length > 0 ? queueWordIds : [EMPTY_UUID]);

  if (queueVocabDetailsError) {
    throw queueVocabDetailsError;
  }

  const wordProgressMap = new Map((wordProgressRows ?? []).map((row) => [row.word_id, row]));
  const queueVocabDetailMap = new Map(
    (queueVocabDetails ?? []).map((row: any) => [row.id, row])
  );
  const queueCandidateMap = new Map(
    activeQueueCandidates.map((candidate) => [candidate.word_id, candidate])
  );

  const attemptedWordIdSet = new Set(
    (attemptedWordIds.data ?? []).map((row: any) => row.target_word_id).filter(Boolean)
  );
  const activeQueueWordIdSet = new Set(queueWordIds);

  const recentNewWordDetails = allReadyVocabularyDetails.filter((detail: any) => {
    if (!detail?.id) return false;
    if (activeQueueWordIdSet.has(detail.id)) return false;
    if (attemptedWordIdSet.has(detail.id)) return false;
    return true;
  });
  const continuationReadyDetails = allReadyVocabularyDetails.filter((detail: any) => {
    if (!detail?.id) return false;
    if (activeQueueWordIdSet.has(detail.id)) return false;
    if (recentNewWordDetails.some((candidate) => candidate.id === detail.id)) return false;
    return Boolean(wordProgressMap.get(detail.id));
  });

  const recentLessonIds = Array.from(
    new Set(
      recentNewWordDetails
        .map((detail: any) => detail.lesson_id)
        .filter((lessonId: string | null) => Boolean(lessonId))
    )
  ).slice(0, 8);

  const audioCandidateDetails = [
    ...(queueVocabDetails ?? []),
    ...recentNewWordDetails,
    ...continuationReadyDetails,
  ].filter((detail: any) => Boolean(detail?.id));
  const audioLessonIds = Array.from(
    new Set(
      audioCandidateDetails
        .map((detail: any) => detail.lesson_id)
        .filter((lessonId: string | null) => Boolean(lessonId))
    )
  );
  const lessonIdsForLookup = Array.from(new Set([...recentLessonIds, ...audioLessonIds]));

  const { data: recentLessons, error: recentLessonsError } = await supabase
    .from("lessons")
    .select("id, name, lesson_type")
    .in("id", lessonIdsForLookup.length > 0 ? lessonIdsForLookup : [EMPTY_UUID]);

  if (recentLessonsError) {
    throw recentLessonsError;
  }

  const recentLessonMetaMap = new Map(
    (recentLessons ?? []).map((lesson: any) => [
      lesson.id,
      {
        lessonName: lesson.name as string,
        lessonType: (lesson.lesson_type as string | null) ?? null,
      },
    ])
  );
  const recentLessonNameMap = new Map(
    Array.from(recentLessonMetaMap.entries()).map(([lessonId, meta]) => [lessonId, meta.lessonName])
  );

  if (preferredLessonId && !recentLessonMetaMap.has(preferredLessonId)) {
    const { data: preferredLesson } = await supabase
      .from("lessons")
      .select("id, name, lesson_type")
      .eq("id", preferredLessonId)
      .maybeSingle();

    if (preferredLesson?.id) {
      recentLessonMetaMap.set(preferredLesson.id, {
        lessonName: preferredLesson.name as string,
        lessonType: (preferredLesson.lesson_type as string | null) ?? null,
      });
      recentLessonNameMap.set(preferredLesson.id, preferredLesson.name as string);
    }
  }

  const lessonIdsForCaptures = Array.from(
    new Set([
      ...(queueVocabDetails ?? []).map((detail: any) => detail.lesson_id).filter(Boolean),
      ...recentNewWordDetails.map((detail: any) => detail.lesson_id).filter(Boolean),
      ...continuationReadyDetails.map((detail: any) => detail.lesson_id).filter(Boolean),
    ])
  );

  const { data: sourceCaptureRows, error: sourceCaptureError } = await supabase
    .from("vocabulary_capture_events")
    .select("lesson_id, passage_id, item_text, context_text, created_at")
    .eq("student_id", studentData.id)
    .in("lesson_id", lessonIdsForCaptures.length > 0 ? lessonIdsForCaptures : [EMPTY_UUID])
    .order("created_at", { ascending: false })
    .limit(500);

  if (sourceCaptureError) {
    throw sourceCaptureError;
  }

  const passageIds = Array.from(
    new Set((sourceCaptureRows ?? []).map((row: any) => row.passage_id).filter(Boolean))
  );

  const { data: lessonPassages, error: lessonPassagesError } = await supabase
    .from("lesson_passages")
    .select("id, title")
    .in("id", passageIds.length > 0 ? passageIds : [EMPTY_UUID]);

  if (lessonPassagesError) {
    throw lessonPassagesError;
  }

  const lessonPassageTitleMap = new Map(
    (lessonPassages ?? []).map((passage: any) => [passage.id, (passage.title as string | null) ?? null])
  );
  const sourceCaptureMap = new Map<string, SourceCaptureMeta>();

  for (const row of sourceCaptureRows ?? []) {
    if (!row?.lesson_id || !row?.item_text) {
      continue;
    }

    const key = `${row.lesson_id}:${String(row.item_text).trim().toLowerCase()}`;

    if (sourceCaptureMap.has(key)) {
      continue;
    }

    sourceCaptureMap.set(key, {
      lessonId: row.lesson_id ?? null,
      passageId: row.passage_id ?? null,
      passageTitle: row.passage_id ? lessonPassageTitleMap.get(row.passage_id) ?? null : null,
      contextSnippet: row.context_text ?? null,
      capturedAt: row.created_at ?? null,
    });
  }
  const audioPreparation = summarizeAudioPreparation({
    details: audioCandidateDetails,
    lessonNameMap: recentLessonNameMap,
  });

  const queueDrillItems = activeQueueCandidates
    .map((candidate) => {
      const detail = queueVocabDetailMap.get(candidate.word_id);
      const wordProgress = wordProgressMap.get(candidate.word_id);
      if (!wordProgress) return null;
      return toDrillItem(detail, wordProgress.id, recentLessonMetaMap, sourceCaptureMap);
    })
    .filter(Boolean) as DrillItem[];

  const newWordDrillItems = recentNewWordDetails
    .map((detail: any) => toDrillItem(detail, `new:${detail.id}`, recentLessonMetaMap, sourceCaptureMap))
    .filter(Boolean) as DrillItem[];
  const continuationDrillItems = continuationReadyDetails
    .map((detail: any) => {
      const wordProgress = wordProgressMap.get(detail.id);
      return toDrillItem(
        detail,
        wordProgress?.id ?? `continuation:${detail.id}`,
        recentLessonMetaMap,
        sourceCaptureMap
      );
    })
    .filter(Boolean) as DrillItem[];
  const matchedQueueCount = preferredLessonId
    ? queueDrillItems.filter((item) => item.sourceLessonId === preferredLessonId).length
    : 0;
  const matchedNewWordCount = preferredLessonId
    ? newWordDrillItems.filter((item) => item.sourceLessonId === preferredLessonId).length
    : 0;
  const matchedContinuationCount = preferredLessonId
    ? continuationDrillItems.filter((item) => item.sourceLessonId === preferredLessonId).length
    : 0;
  const matchedWordCount = preferredLessonId
    ? new Set(
        [
          ...queueDrillItems
            .filter((item) => item.sourceLessonId === preferredLessonId)
            .map((item) => item.vocabularyItemId),
          ...newWordDrillItems
            .filter((item) => item.sourceLessonId === preferredLessonId)
            .map((item) => item.vocabularyItemId),
          ...continuationDrillItems
            .filter((item) => item.sourceLessonId === preferredLessonId)
            .map((item) => item.vocabularyItemId),
        ].filter(Boolean)
      ).size
    : 0;

  const queueExercisePool = buildExercisePoolFromDrillItems(queueDrillItems);
  const queueExercises = [
    ...attachQueueReviewMeta(queueExercisePool.exercises, queueCandidateMap, wordProgressMap),
  ];

  const recentLessonsSummary = Array.from(
    recentNewWordDetails.reduce<
      Map<string, { lessonId: string; lessonName: string; readyNewWordCount: number }>
    >((acc, detail: any) => {
      if (!detail.lesson_id) {
        return acc;
      }

      const existing = acc.get(detail.lesson_id);
      if (existing) {
        existing.readyNewWordCount += 1;
        return acc;
      }

      acc.set(detail.lesson_id, {
        lessonId: detail.lesson_id,
        lessonName: recentLessonNameMap.get(detail.lesson_id) ?? "Untitled lesson",
        readyNewWordCount: 1,
      });

      return acc;
    }, new Map()).values()
  )
    .sort((a, b) => b.readyNewWordCount - a.readyNewWordCount)
    .slice(0, 4);

  const newWordExercisePool = buildExercisePoolFromDrillItems(newWordDrillItems);
  const newWordExercises = attachNewWordReviewMeta(newWordExercisePool.exercises);
  const continuationExercisePool = buildExercisePoolFromDrillItems(continuationDrillItems);
  const continuationExercises = attachContinuationReviewMeta(
    continuationExercisePool.exercises,
    wordProgressMap
  );

  const adaptiveWordIds = Array.from(
    new Set([
      ...queueDrillItems.map((item) => item.vocabularyItemId),
      ...newWordDrillItems.map((item) => item.vocabularyItemId),
      ...continuationDrillItems.map((item) => item.vocabularyItemId),
    ])
  );

  const { data: recentAttemptsRows, error: recentAttemptsError } = await supabase
    .from("exercise_attempts")
    .select("*")
    .eq("student_id", studentData.id)
    .in("target_word_id", adaptiveWordIds.length > 0 ? adaptiveWordIds : [EMPTY_UUID])
    .order("created_at", { ascending: false })
    .limit(300);

  if (recentAttemptsError) {
    throw recentAttemptsError;
  }

  const recentAttemptsByWordId = groupRecentAttemptsByWord(
    (recentAttemptsRows ?? []) as ExerciseAttemptRow[]
  );

  const adaptiveQueueCandidates = buildAdaptiveWordCandidates({
    exercises: queueExercises,
    recentAttemptsByWordId,
    wordProgressMap,
    queueCandidateMap,
    isNewWord: false,
  });
  const adaptiveNewWordCandidates = buildAdaptiveWordCandidates({
    exercises: newWordExercises,
    recentAttemptsByWordId,
    isNewWord: true,
  });
  const adaptiveContinuationCandidates = buildAdaptiveWordCandidates({
    exercises: continuationExercises,
    recentAttemptsByWordId,
    wordProgressMap,
    isNewWord: false,
  });
  const priorityCandidates =
    selectedMode === "learn_new_words"
      ? adaptiveNewWordCandidates
      : [...adaptiveQueueCandidates, ...adaptiveNewWordCandidates];
  const continuationCandidates =
    selectedMode === "learn_new_words"
      ? [...adaptiveNewWordCandidates, ...adaptiveContinuationCandidates]
      : [...adaptiveQueueCandidates, ...adaptiveNewWordCandidates, ...adaptiveContinuationCandidates];
  const priorityTargetSize = Math.min(
    selectedMode === "learn_new_words" ? 6 : 8,
    Math.max(priorityCandidates.length, 0)
  );
  const continuationTargetSize = Math.min(
    selectedMode === "learn_new_words" ? 6 : 8,
    Math.max(continuationCandidates.length, 0)
  );
  const today = new Date().toISOString().slice(0, 10);
  const prioritySelection =
    priorityTargetSize > 0
      ? selectAdaptiveSessionExercises({
          mode: selectedMode,
          phase: "priority_review",
          candidates: priorityCandidates,
          targetSize: priorityTargetSize,
          preferredLessonId,
          seed: `${studentData.id}:${today}:${selectedMode}:priority:${bucketCounts.recently_failed}:${bucketCounts.weak_again}:${bucketCounts.overdue}:${newWordExercises.length}`,
        })
      : null;
  const continuationSelection =
    continuationTargetSize > 0
      ? selectAdaptiveSessionExercises({
          mode: selectedMode,
          phase: "endless_continuation",
          candidates: continuationCandidates,
          targetSize: continuationTargetSize,
          preferredLessonId,
          seed: `${studentData.id}:${today}:${selectedMode}:continuation:${bucketCounts.recently_failed}:${bucketCounts.weak_again}:${bucketCounts.overdue}:${continuationExercises.length}:${newWordExercises.length}`,
        })
      : null;
  const activePhase =
    requestedPhase === "endless_continuation"
      ? continuationSelection
        ? "endless_continuation"
        : prioritySelection
          ? "priority_review"
          : null
      : requestedPhase === "priority_review"
        ? prioritySelection
          ? "priority_review"
          : continuationSelection
            ? "endless_continuation"
            : null
        : prioritySelection
          ? "priority_review"
          : continuationSelection
            ? "endless_continuation"
            : null;
  const adaptiveSelection =
    activePhase === "endless_continuation" ? continuationSelection : prioritySelection;
  const allSelectableExercises =
    selectedMode === "learn_new_words"
      ? [...newWordExercises, ...continuationExercises]
      : [...queueExercises, ...newWordExercises, ...continuationExercises];
  const selectedExercisePool = adaptiveSelection
    ? attachAdaptiveSelectionMeta({
        exercises: allSelectableExercises,
        selectedWords: adaptiveSelection.summary.selectedWords,
      })
    : [];
  const selectedDrillCounts =
    activePhase === "endless_continuation"
      ? continuationExercisePool
      : selectedMode === "learn_new_words"
        ? newWordExercisePool
        : queueExercisePool;

  const session =
    selectedExercisePool.length > 0
      ? buildVocabExerciseSession({
          exercises: selectedExercisePool,
          mode: selectedMode,
          phase: activePhase ?? "priority_review",
          continuationAvailable: continuationSelection !== null,
          targetSize: adaptiveSelection?.summary.targetSize,
          seed: `${studentData.id}:${today}:${selectedMode}:${activePhase ?? "priority_review"}:${bucketCounts.recently_failed}:${bucketCounts.weak_again}:${bucketCounts.overdue}:${continuationExercises.length}:${newWordExercises.length}`,
        })
      : null;

  const totalQueueItems = activeQueueCandidates.length;
  const readyDrillsCount = queueDrillItems.length;
  const topPriorityBucket = pickTopPriorityBucket(bucketCounts);
  const dueNowCount = activeQueueCandidates.filter(
    (candidate) => new Date(candidate.scheduled_for).getTime() <= now.getTime()
  ).length;
  const overdueRetentionChecks = activeQueueCandidates.filter((candidate) => {
    const metadata =
      candidate.metadata && typeof candidate.metadata === "object"
        ? (candidate.metadata as Record<string, unknown>)
        : null;

    return (
      new Date(candidate.scheduled_for).getTime() <= now.getTime() &&
      Boolean(metadata?.due_by_time_gap)
    );
  }).length;
  const weakReinforcementCount = activeQueueCandidates.filter((candidate) => {
    const bucket = classifyReviewQueueCandidate(candidate, now);
    return bucket === "recently_failed" || bucket === "weak_again";
  }).length;
  const masteryDistribution = vocabularyAnalytics.masteryDistribution;
  const totalTrackedWords = vocabularyAnalytics.summary.capturedWordsCount;
  const totalWordsLearned = totalTrackedWords - getLifecycleCount(masteryDistribution, "new");
  const masteredWords = vocabularyAnalytics.summary.masteredWordsCount;
  const wordsInReview = getLifecycleCount(masteryDistribution, "review");
  const practicedTodayWords = vocabularyAnalytics.summary.practicedTodayWordsCount;
  const currentStreak = Number(gamificationResult?.streak_days ?? 0);
  const longestStreakCandidate = Number(
    (gamificationResult as Record<string, unknown> | null)?.longest_streak_days ??
      currentStreak
  );
  const longestStreak = Number.isFinite(longestStreakCandidate)
    ? Math.max(currentStreak, longestStreakCandidate)
    : currentStreak;

  return {
    student: studentData,
    selectedMode,
    selectedPhase: activePhase ?? "priority_review",
    dashboard: {
      totals: {
        totalWordsLearned,
        masteredWords,
        wordsInReview,
        weakWords: vocabularyAnalytics.summary.weakWordCount,
        practicedTodayWords,
        totalTrackedWords,
      },
      reviewIndicators: {
        dueNow: dueNowCount,
        overdueRetentionChecks,
        weakReinforcement: weakReinforcementCount,
      },
      masteryDistribution,
      streak: {
        current: currentStreak,
        longest: longestStreak,
      },
    },
    summary: {
      totalQueueItems,
      dueNowCount,
      readyDrillsCount,
      priorityReadyCount: priorityCandidates.length,
      continuationReadyCount: continuationCandidates.length,
      canContinueEndlessly: continuationSelection !== null,
      activePhase,
      activePhaseLabel: getSessionPhaseLabel(activePhase),
      readyPercent: totalQueueItems > 0 ? Math.round((readyDrillsCount / totalQueueItems) * 100) : 0,
      newWordPoolCount: newWordExercises.length,
      bucketCounts,
      topPriorityBucket,
      topPriorityLabel: getBucketLabel(topPriorityBucket),
      upcomingWords: nextQueueCandidates
        .map((candidate) => candidate.word)
        .filter((word): word is string => Boolean(word))
        .slice(0, 4),
      audioPreparation,
      learnNewWords: {
        newestCapturedItems: recentNewWordDetails
          .map((detail: any) => detail.item_text)
          .filter((itemText: string | null) => Boolean(itemText))
          .slice(0, 6),
        recentLessons: recentLessonsSummary,
      },
      lessonFocus:
        preferredLessonId &&
        (matchedQueueCount > 0 || matchedNewWordCount > 0 || matchedContinuationCount > 0)
          ? {
              lessonId: preferredLessonId,
              lessonName:
                recentLessonNameMap.get(preferredLessonId) ??
                recentLessonMetaMap.get(preferredLessonId)?.lessonName ??
                "Lesson words",
              matchedWordCount,
              matchedReadyCount: matchedQueueCount,
              matchedNewWordCount,
              matchedContinuationCount,
            }
          : null,
    },
    adaptiveSelection: adaptiveSelection?.summary ?? null,
    drillCounts: {
      words: selectedDrillCounts.wordDrills.length,
      phrases: selectedDrillCounts.phraseDrills.length,
      cloze: selectedDrillCounts.clozeDrills.length,
    },
    session,
    preparationNeeded: !session &&
      (selectedMode === "learn_new_words"
        ? newWordExercises.length === 0 && vocabularyDetailRows.length > 0
        : readyDrillsCount < totalQueueItems),
  } satisfies StudentVocabularyPageData;
}
